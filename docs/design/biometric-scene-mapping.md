# Biometric scene mapping

Status: accepted art direction. The landscape implementation uses accepted source
geometry, recording duration, signal confidence and a saved seed. Pulse-rate-led
ambient motion, RMSSD/SDNN-driven placement and optional mood check-ins remain
future ideas. This is not a stress classifier.

Pulse Painting expresses the recording's shape and rhythm. Scene choice remains
seeded and independent of health interpretation. A meadow is not a calm score;
mountains are not a stress score. All valid recordings receive the same care in
composition and polish.

## Mapping contract

| Source | Artistic response | Validity and meaning |
| --- | --- | --- |
| Accepted waveform geometry | Actual curves form the scenery | Preserve within-run timing and shape; no invented beats or added notches |
| Pulse rate | Bounded pace of the brush presentation and gentle ambient motion | Respect measured timing and analysis delay; no heart-rate-to-stress label |
| Valid successive beat variation / RMSSD | Subtle variation in inter-stroke spacing, grouping and visual rhythm | Change placement around source paths, not their internal timing; no high-is-good score |
| Valid broader interval variation / SDNN | Restrained differences between contour layers | Do not compare unequal recording durations as if interchangeable; no personality or emotion inference |
| Accepted recording duration | More layers, narrower row gaps and greater coverage | Use accepted time, not raw sample count, rejected noise, wall-clock interruptions or duplicate samples |
| Signal confidence | Clearer pigment definition within a readable palette | Describes recording confidence, not emotional or medical condition; rejected runs add no paint |
| Saved per-session seed | Family, horizon, viewpoint, bounded palette and landform placement | Same session re-exports identically; new sessions may differ even with similar summary metrics |
| Optional user check-in | A user-chosen mood word or optional palette preference | Explicit self-report; never imply the sensor inferred it; omitted from shared art by default |

Use existing library validity flags and quality windows. Do not calculate a new
stress score, invent medical cutoffs, or use LF/HF as a stress dial. If RMSSD or
SDNN is unavailable, keep the measured curves and choose neutral scene placement
from the saved seed. Art can remain eligible when a metric is not.

No personal baseline exists on first use. A later baseline feature would need
deliberate, comparable recordings and explicit history handling. It must not be
silently inferred from a population average. Even with a baseline, a change in
pulse or variability would be described as a change in those measurements, not
proof of stress, calm, recovery, readiness or any diagnosis.

An optional check-in may offer words such as calm, tense, energized or tired,
including a skip choice. It must be clear these are the user's words. Check-in
text and raw measurements do not enter public export metadata automatically.

## Robustness and acceptance

- All primary paths carry source ranges and use accepted data only.
- Varying sample rate alone does not alter scene density.
- Missing metrics use neutral bounded art parameters, never synthetic values.
- Noisy, clipped or duplicate samples cannot make a scene denser or more dramatic.
- Short, uniform and variable recordings each have intentional sparse and dense
  presentations; visual quality never rewards a physiological value.
- No accepted source data offers retry without creating purported personal art.
- During dropout, hold the last valid stroke, lift the brush and keep camera
  coaching visible; no false progress or pigment is added.
- Source capture, acceptance and protocol timing remain independent of animation.
- Export preserves the seed, placements and accepted geometry seen during capture;
  image output omits raw data and the private replay descriptor.

## Evidence and interpretation

Smartphone PPG can covary with self-reported stress in controlled tasks. A
preregistered study of 102 university students found associations with concurrent
and subsequent self-reported stress/anxiety during a digital social stressor.
That supports studying relationships; it does not validate this app as an
individual-session stress classifier.

- [Nelson et al. (2023), Smartphone Photoplethysmography Pulse Rate Covaries With Stress and Anxiety During a Digital Acute Social Stressor](https://pubmed.ncbi.nlm.nih.gov/37409791/)

A 17-participant smartphone PPG/thermal study reported low correlations between
short-recording conventional cardiovascular metrics and perceived stress, and
discussed individual normalization. Its experimental model is not a transferable
accuracy claim for Pulse Painting.

- [Cho et al. (2019), Instant Stress](https://pubmed.ncbi.nlm.nih.gov/30964440/)

A smartphone HRV validation study compared measurements in 14 healthy young
adults in a seated posture and explicitly limited conclusions to its tested
device and operating system. Measurement validity and emotional interpretation
are separate questions.

- [Examining the Light Heart Mobile Device App: Validation Study (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11372322/)

The mappings above are creative product decisions informed by these limitations,
not findings that particular landscapes or colors represent particular emotions.
