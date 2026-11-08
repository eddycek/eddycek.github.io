// macOS only. Usage: swift scripts/segment.swift <photo> <out.png>; writes the person cutout with alpha.
import Vision
import CoreImage
import Foundation
let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1]); let output = URL(fileURLWithPath: args[2])
let ci = CIImage(contentsOf: input, options: [.applyOrientationProperty: true])!
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
let h = VNImageRequestHandler(ciImage: ci, options: [:])
try h.perform([req])
let mask = CIImage(cvPixelBuffer: req.results!.first!.pixelBuffer)
let sx = ci.extent.width / mask.extent.width, sy = ci.extent.height / mask.extent.height
let m = mask.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
let out = ci.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: m])
let ctx = CIContext()
try ctx.writePNGRepresentation(of: out, to: output, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
