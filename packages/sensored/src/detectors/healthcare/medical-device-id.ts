import { ContextDetector, streamMeta } from "../base";

export class MedicalDeviceIdDetector extends ContextDetector {
  readonly id = "medical_device_id";
  readonly entityType = "medical_device_id";
  readonly replacement = "[MEDICAL_DEVICE_ID]";

  protected readonly pattern =
    /(?:DEVICE|IMPLANT|PACEMAKER|DEFIBRILLATOR)[-\s]?(?:SERIAL|SN|S\/N)[-\s]?[:#]?\s*[A-Z0-9]{8,20}/gi;
  protected readonly contextLabels =
    "(?:Device|Implant|Pacemaker|Defibrillator|Serial|Medical)";
  protected readonly labelStrings = [
    "Device",
    "Implant",
    "Pacemaker",
    "Defibrillator",
    "Serial",
    "Medical",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    35,
    this.leftContext,
    this.rightContext,
  );
}

export const medicalDeviceIdDetector = new MedicalDeviceIdDetector();
