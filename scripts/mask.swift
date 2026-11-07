// Writes a soft foreground mask (8-bit gray PNG, image size) for the subject in a photo, using Vision.
import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let handler = VNImageRequestHandler(url: input)
let request = VNGenerateForegroundInstanceMaskRequest()
do {
  try handler.perform([request])
  guard let result = request.results?.first else { print("no subject"); exit(1) }
  let buffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
  let image = CIImage(cvPixelBuffer: buffer)
  let context = CIContext()
  try context.writePNGRepresentation(of: image, to: output, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())
  print("instances", result.allInstances.count, "size", image.extent.size)
} catch { print("error", error); exit(1) }
