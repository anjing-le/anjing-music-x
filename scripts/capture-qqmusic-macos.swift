import Foundation
import Darwin
import CoreGraphics
import CoreMedia
import AudioToolbox
@preconcurrency import AVFoundation
@preconcurrency import ScreenCaptureKit

private let targetBundle = "com.tencent.QQMusicMac"
private let sampleRate = 48_000.0
private let minimumDuration = 1.0 / sampleRate
private let maximumDuration = 600.0

private struct CaptureError: Error, CustomStringConvertible {
    let description: String
    let code: Int32
    init(_ description: String, code: Int32 = 1) { self.description = description; self.code = code }
}

private struct Options {
    var listApps = false
    var duration: Double?
    var output: URL?
    var help = false

    init(_ args: [String]) throws {
        var index = 0
        while index < args.count {
            switch args[index] {
            case "--help", "-h": help = true
            case "--list-apps": listApps = true
            case "--duration":
                guard duration == nil else { throw CaptureError("--duration may only be supplied once.") }
                index += 1
                guard index < args.count, let value = Double(args[index]), value.isFinite,
                      value >= minimumDuration, value <= maximumDuration else {
                    throw CaptureError("--duration must be at least one audio frame (1/48000 seconds) and at most 600 seconds.")
                }
                duration = value
            case "--output":
                guard output == nil else { throw CaptureError("--output may only be supplied once.") }
                index += 1
                guard index < args.count, !args[index].isEmpty, !args[index].hasPrefix("--") else {
                    throw CaptureError("--output requires a nonempty file path.")
                }
                output = URL(fileURLWithPath: (args[index] as NSString).expandingTildeInPath).standardizedFileURL
            default: throw CaptureError("Unknown argument: \(args[index])")
            }
            index += 1
        }
        if args.isEmpty { help = true }
        if help { return }
        if listApps {
            guard duration == nil, output == nil else { throw CaptureError("--list-apps cannot record audio.") }
            return
        }
        guard duration != nil, let output else { throw CaptureError("Recording requires both --duration and --output.") }
        guard ["wav", "caf"].contains(output.pathExtension.lowercased()) else {
            throw CaptureError("Output must have a .wav or .caf extension (lossless Float32 PCM).")
        }
        var outputStatus = stat()
        guard lstat(output.path, &outputStatus) != 0 else {
            throw CaptureError("Refusing to overwrite an existing output file.")
        }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: output.deletingLastPathComponent().path, isDirectory: &isDirectory),
              isDirectory.boolValue else { throw CaptureError("Output parent directory does not exist.") }
        guard FileManager.default.isWritableFile(atPath: output.deletingLastPathComponent().path) else {
            throw CaptureError("Output parent directory is not writable.")
        }
    }
}

private struct PCMStats {
    var buffers: UInt64 = 0
    var frames: UInt64 = 0
    var samples: UInt64 = 0
    var nonZero: UInt64 = 0
    var peak = 0.0
    var squares = 0.0
    var firstPTS: Double?
    var lastPTS: Double?
    var rms: Double { samples == 0 ? 0 : sqrt(squares / Double(samples)) }
}

// All file access and sample statistics are confined to the one sample queue.
private final class AudioSink: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "cc.anjing.qa.qqmusic-audio")
    private let output: URL
    private let frameBudget: UInt64
    private var file: AVAudioFile?
    private var accepting = true
    private var stats = PCMStats()
    private var failure: Error?

    init(output: URL, duration: Double) {
        self.output = output
        self.frameBudget = max(1, UInt64(floor(duration * sampleRate)))
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard accepting, failure == nil, type == .audio,
              sampleBuffer.isValid, CMSampleBufferDataIsReady(sampleBuffer) else { return }
        do {
            guard let description = sampleBuffer.formatDescription else { throw CaptureError("Audio format description is missing.") }
            let format = AVAudioFormat(cmAudioFormatDescription: description)
            guard format.sampleRate == sampleRate, format.channelCount == 2, format.commonFormat == .pcmFormatFloat32 else {
                throw CaptureError("Unexpected audio format: expected 48 kHz, stereo Float32 PCM.")
            }
            guard stats.frames < frameBudget else { accepting = false; return }
            let sourceCount = CMSampleBufferGetNumSamples(sampleBuffer)
            guard sourceCount > 0, sourceCount <= Int(Int32.max) else { return }
            // Copy just the remaining frames, including the final partial buffer.
            let count = min(sourceCount, Int(frameBudget - stats.frames))
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)) else { return }
            buffer.frameLength = AVAudioFrameCount(count)
            let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, at: 0,
                frameCount: Int32(count), into: buffer.mutableAudioBufferList)
            guard status == noErr else { throw CaptureError("Could not copy real PCM data (OSStatus \(status)).") }

            if file == nil {
                let settings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatLinearPCM,
                    AVSampleRateKey: sampleRate,
                    AVNumberOfChannelsKey: 2,
                    AVLinearPCMBitDepthKey: 32,
                    AVLinearPCMIsFloatKey: true,
                    AVLinearPCMIsBigEndianKey: false,
                    AVLinearPCMIsNonInterleaved: false,
                ]
                file = try AVAudioFile(forWriting: output, settings: settings,
                                      commonFormat: format.commonFormat, interleaved: format.isInterleaved)
            }
            var chunkStats = PCMStats()
            for audioBuffer in UnsafeMutableAudioBufferListPointer(buffer.mutableAudioBufferList) {
                guard let data = audioBuffer.mData else { continue }
                let values = data.assumingMemoryBound(to: Float.self)
                let valueCount = count * Int(audioBuffer.mNumberChannels)
                guard valueCount * MemoryLayout<Float>.size <= Int(audioBuffer.mDataByteSize) else {
                    throw CaptureError("PCM buffer is smaller than the frames selected for writing.")
                }
                for index in 0..<valueCount {
                    let value = Double(values[index])
                    guard value.isFinite else { throw CaptureError("Audio sample contains a non-finite PCM value.") }
                    chunkStats.samples += 1
                    if value != 0 { chunkStats.nonZero += 1 }
                    chunkStats.peak = max(chunkStats.peak, abs(value))
                    chunkStats.squares += value * value
                }
            }
            guard let file else { throw CaptureError("Audio output was not initialized.") }
            try file.write(from: buffer)
            stats.samples += chunkStats.samples
            stats.nonZero += chunkStats.nonZero
            stats.peak = max(stats.peak, chunkStats.peak)
            stats.squares += chunkStats.squares
            stats.buffers += 1
            stats.frames += UInt64(count)
            let pts = CMTimeGetSeconds(sampleBuffer.presentationTimeStamp)
            if pts.isFinite {
                if stats.firstPTS == nil { stats.firstPTS = pts }
                stats.lastPTS = pts + Double(count) / sampleRate
            }
            if stats.frames == frameBudget { accepting = false }
        } catch { failure = error }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        queue.async { self.failure = self.failure ?? error }
    }

    func finish() throws -> PCMStats {
        try queue.sync {
            accepting = false
            file = nil // Finalize the lossless container before reporting results.
            if let failure { throw failure }
            return stats
        }
    }
}

@main
private struct Main {
    static func main() async {
        do {
            let options = try Options(Array(CommandLine.arguments.dropFirst()))
            if options.help {
                print("""
                QQMusicAudioCapture --list-apps
                QQMusicAudioCapture --duration SECONDS --output /absolute/path/recording.wav
                Captures only \(targetBundle), 48 kHz stereo Float32 PCM, at most 600 seconds.
                Duration is capped to floor(SECONDS * 48000) PCM frames (minimum one frame).
                No microphone or screen output. No permission request or System Settings UI.
                Existing screen/system-audio capture permission is required; never overwrites files.
                Ctrl-C or SIGTERM stops and finalizes the current recording.
                """)
                return
            }
            // This check never opens a permission dialog. A failed check is explicit;
            // the human/root agent must handle authorization before starting this tool.
            guard CGPreflightScreenCaptureAccess() else {
                throw CaptureError("ScreenCaptureKit permission is not available to this process. Grant screen/system-audio recording to its responsible app, then retry. No permission request was made.", code: 2)
            }
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
            if options.listApps {
                print("ScreenCaptureKit content access: available")
                for app in content.applications.sorted(by: { $0.bundleIdentifier < $1.bundleIdentifier }) {
                    print("\(app.bundleIdentifier) | \(app.applicationName) | pid=\(app.processID)")
                }
                return
            }
            guard let app = content.applications.first(where: { $0.bundleIdentifier == targetBundle }) else {
                throw CaptureError("QQMusic (\(targetBundle)) is not among the available applications; no recording started.", code: 3)
            }
            guard let display = content.displays.first else { throw CaptureError("No display is available for the application filter.", code: 3) }
            guard let output = options.output, let duration = options.duration else { return }
            let configuration = SCStreamConfiguration()
            configuration.width = 2
            configuration.height = 2
            configuration.minimumFrameInterval = CMTime(value: 1, timescale: 1)
            configuration.queueDepth = 3
            configuration.showsCursor = false
            configuration.capturesAudio = true
            configuration.sampleRate = Int(sampleRate)
            configuration.channelCount = 2
            configuration.excludesCurrentProcessAudio = true
            if #available(macOS 15, *) { configuration.captureMicrophone = false }
            let sink = AudioSink(output: output, duration: duration)
            let filter = SCContentFilter(display: display, including: [app], exceptingWindows: [])
            let stream = SCStream(filter: filter, configuration: configuration, delegate: sink)
            // Only .audio is registered. No microphone stream or screen samples.
            try stream.addStreamOutput(sink, type: .audio, sampleHandlerQueue: sink.queue)
            try await stream.startCapture()
            print("Started: \(targetBundle), pid=\(app.processID), requested=\(duration)s, output=\(output.path)")
            let sleepTask = Task { try await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000)) }
            let signals: [Int32] = [SIGINT, SIGTERM]
            let previousHandlers = signals.map { signal($0, SIG_IGN) }
            let signalSources = signals.map { value -> DispatchSourceSignal in
                let source = DispatchSource.makeSignalSource(signal: value, queue: .global(qos: .userInitiated))
                source.setEventHandler { sleepTask.cancel() }
                source.resume()
                return source
            }
            defer {
                signalSources.forEach { $0.cancel() }
                for (index, value) in signals.enumerated() { signal(value, previousHandlers[index]) }
            }
            var waitError: Error?
            do { try await sleepTask.value }
            catch is CancellationError { print("Stop requested; finalizing captured audio.") }
            catch { waitError = error }
            var stopError: Error?
            do { try await stream.stopCapture() } catch { stopError = error }
            let stats = try sink.finish()
            print(String(format: "PCM_STAT buffers=%llu frames=%llu samples=%llu nonZeroSamples=%llu peak=%.9f rms=%.9f pcmSeconds=%.6f",
                stats.buffers, stats.frames, stats.samples, stats.nonZero, stats.peak, stats.rms, Double(stats.frames) / sampleRate))
            if let first = stats.firstPTS, let last = stats.lastPTS {
                print(String(format: "Source timestamp span: %.6fs", last - first))
            }
            if let waitError { throw waitError }
            if let stopError { throw stopError }
            guard stats.frames > 0 else { throw CaptureError("No actual PCM samples arrived; recording is unverified.", code: 4) }
            guard stats.nonZero > 0, stats.peak > 0, stats.rms > 0 else {
                throw CaptureError("All captured PCM samples are zero; recording is silent and not a successful capture.", code: 4)
            }
            let saved = try AVAudioFile(forReading: output)
            let allowedFrames = max(1, UInt64(floor(duration * sampleRate)))
            guard saved.length == Int64(stats.frames), stats.frames <= allowedFrames else {
                throw CaptureError("Saved PCM frame count does not match the capture budget.", code: 4)
            }
            print(String(format: "Saved lossless PCM: rate=%.0f channels=%u frames=%lld seconds=%.6f",
                saved.fileFormat.sampleRate, saved.fileFormat.channelCount, saved.length,
                Double(saved.length) / saved.fileFormat.sampleRate))
        } catch {
            let message = "ERROR: \(error)\n"
            FileHandle.standardError.write(Data(message.utf8))
            exit((error as? CaptureError)?.code ?? 1)
        }
    }
}
