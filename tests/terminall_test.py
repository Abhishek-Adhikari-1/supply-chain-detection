from pathlib import Path
from scanner_predictor import scan_and_predict

print("\n🔍 SUPPLY CHAIN MALWARE SCAN (TERMINAL MODE)\n")

raw = input("📂 Enter project directory path: ").strip().strip('"').strip("'")
p = Path(raw)
project_path = str(p.parent if p.is_file() else p)

report = scan_and_predict(project_path)

print("\n================ SCAN SUMMARY ================\n")
print(f"📦 Packages scanned : {report['packages_scanned']}")
print(f"✅ SAFE            : {report['summary']['SAFE']}")
print(f"⚠️  SUSPICIOUS      : {report['summary']['SUSPICIOUS']}")
print(f"🚨 MALICIOUS       : {report['summary']['MALICIOUS']}")

if report.get("project_risk_signals"):
    print("\n========== PROJECT-LEVEL RISK SIGNALS =========\n")
    for k, v in report["project_risk_signals"].items():
        if v:
            print(f"• {k}: {v}")

print("\n================ RESULTS =====================\n")

for r in report["results"]:
    label_icon = {"SAFE": "✅", "SUSPICIOUS": "⚠️", "MALICIOUS": "🚨"}[r["label"]]

    print(f"{label_icon} {r['package_name']} ({r['ecosystem']})  [depth: {r.get('scan_depth','?')}]")
    print(f"   ▸ Label      : {r['label']}")
    print(f"   ▸ Probability: {r['malicious_probability']:.3f}")
    print(f"   ▸ Confidence : {r['confidence']:.3f}")

    if r["top_reasons"]:
        print("   ▸ Reasons:")
        for reason in r["top_reasons"]:
            print(f"      - {reason}")

    print("-" * 55)

print("\n✅ Scan complete.\n")
