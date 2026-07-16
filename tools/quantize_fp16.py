"""A4 (take 2): FP16 conversion of the deployed v7m5 YOLOX model.

Why FP16 rather than the INT8 build:
  * WebGPU is the app's real backend; fp16 is well supported there, while
    dynamic-INT8 measurably drifted (quadrupled phantom shot windows).
  * fp16 keeps ~3 decimal digits — far more than these activations need —
    so detections should track fp32 almost exactly, at half the bytes.

Converter bug worked around here: convert_float_to_float16(keep_io_types=True)
emits duplicate tensor names ("images_cast_to_") when an I/O feeds multiple
consumers — an SSA violation ORT rejects as "invalid model". So we convert the
GRAPH pure-fp16 (keep_io_types=False) and build the float32 I/O boundary
ourselves with unique names:

    images (fp32, external) --Cast--> images_fp16 --> [fp16 graph] -->
    output_fp16 --Cast--> output (fp32, external)

The external contract stays exactly what shotDetection.js expects: input named
"images", float32; one float32 output of shape [1, 8400, 8].

Output: models/basketball_yolox_tiny_v7m5_fp16.onnx (self-contained, no .data)
"""
import os, time
import onnx
from onnx import TensorProto, helper
from onnxconverter_common import float16

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "models", "basketball_yolox_tiny_v7m5.onnx")
DST = os.path.join(ROOT, "models", "basketball_yolox_tiny_v7m5_fp16.onnx")

print("loading", SRC)
m = onnx.load(SRC)
t0 = time.perf_counter()

m16 = float16.convert_float_to_float16(m, keep_io_types=False)
g = m16.graph
assert len(g.input) == 1 and len(g.output) == 1, "expected single-input/single-output graph"

in_name = g.input[0].name       # "images", now fp16
out_name = g.output[0].name     # "output", now fp16
in_fp16 = in_name + "_fp16"
out_fp16 = out_name + "_fp16"

# Rewire every consumer of the fp16 input to a renamed internal tensor.
for node in g.node:
    for i, nm in enumerate(node.input):
        if nm == in_name:
            node.input[i] = in_fp16
# Rewire the producer(s) of the graph output to a renamed internal tensor.
for node in g.node:
    for i, nm in enumerate(node.output):
        if nm == out_name:
            node.output[i] = out_fp16

# Boundary casts (unique, explicit names — the whole point of this rewrite).
cast_in = helper.make_node("Cast", [in_name], [in_fp16],
                           name="io_cast_input_fp32_to_fp16", to=TensorProto.FLOAT16)
cast_out = helper.make_node("Cast", [out_fp16], [out_name],
                            name="io_cast_output_fp16_to_fp32", to=TensorProto.FLOAT)
g.node.insert(0, cast_in)
g.node.append(cast_out)

# Declare the external boundary as float32 again.
g.input[0].type.tensor_type.elem_type = TensorProto.FLOAT
g.output[0].type.tensor_type.elem_type = TensorProto.FLOAT

# Stale fp16 value_info entries for the renamed tensors would contradict the
# rewiring; drop any that collide with the boundary names.
keep = [vi for vi in g.value_info if vi.name not in (in_name, out_name)]
del g.value_info[:]
g.value_info.extend(keep)

onnx.checker.check_model(m16)
onnx.save(m16, DST)
dt = time.perf_counter() - t0

src_mb = (os.path.getsize(SRC) + (os.path.getsize(SRC + ".data") if os.path.exists(SRC + ".data") else 0)) / 1e6
dst_mb = os.path.getsize(DST) / 1e6
print(f"converted + wrapped in {dt:.0f}s, checker PASSED")
print(f"FP32: {src_mb:.1f}MB  ->  FP16: {dst_mb:.1f}MB")

# Smoke test: load + run in this process before claiming success.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
import numpy as np
import onnxruntime as ort
sess = ort.InferenceSession(DST, providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0]
print("input:", inp.name, inp.type, inp.shape)
out = sess.run(None, {inp.name: np.full((1, 3, 640, 640), 114, dtype=np.float32)})[0]
print("output:", out.shape, out.dtype, "| sample:", [round(float(v), 3) for v in out[0, 0, :4]])
