# Logistics Detectors

## tracking_number

Detects package tracking numbers for UPS, FedEx Express, FedEx Ground, USPS,
and DHL. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { tracking_number: { action: "redact" } },
});

redactor.redact("Tracking Number: 1Z999AA10123456784");
// "Tracking Number: [TRACKING_NUMBER_1]"
```

- **ID**: `tracking_number`
- **Entity type**: `tracking_number`
- **Context required**: Yes (labels: Tracking Number, Tracking No., Tracking No, Tracking ID, Package ID, Shipment ID, Waybill No., Waybill No, Consignment No., Consignment No)
- **Stream supported**: Yes (maxMatchLength: 22)
- **Validation**: Carrier-specific checksums — UPS (mod-10 weighted), FedEx Express (mod-11), FedEx Ground (mod-10), USPS (mod-10), DHL (mod-7)
