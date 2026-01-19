import json
import pickle
import pandas as pd

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score

DATASET_CSV = "security_packages_dataset.csv"
OUT_MODEL = "security_model.pkl"

# Features expected in your CSV (only those that exist will be used)
FEATURES = [
    "downloads_count", "age_days",
    "maintainer_changes",
    "dependency_count", "new_dependencies",
    "code_lines_added", "code_lines_removed", "code_change_ratio",
    "has_install_scripts", "has_postinstall_hook",
    "network_calls_count", "external_urls_count", "suspicious_urls",
    "file_system_read_ops", "file_system_write_ops",
    "env_var_access", "crypto_operations",
    "obfuscation_score", "minified_code",
    "eval_usage", "exec_usage", "base64_encoding",
    "shell_command_exec", "remote_code_download",
    "data_exfiltration_patterns", "keylogger_patterns", "backdoor_patterns",
    "typosquatting_score", "name_similarity_popular",
    "author_email_disposable", "author_new_account",
    "has_readme", "has_license", "has_tests",
    "version_jump_suspicious", "release_time_anomaly",
]

# Explanations shown in dashboard "reasons"
FEATURE_EXPLANATIONS = {
    "has_install_scripts": "📜 Install scripts present (attack vector)",
    "has_postinstall_hook": "🪝 Postinstall hook runs after install",
    "remote_code_download": "📥 Downloads remote code (high risk)",
    "shell_command_exec": "🐚 Executes shell commands",
    "data_exfiltration_patterns": "📤 Possible data exfiltration behavior",
    "keylogger_patterns": "⌨️ Keylogger-like behavior patterns",
    "backdoor_patterns": "🚪 Backdoor/reverse shell patterns",
    "obfuscation_score": "🔒 Code obfuscation indicators",
    "minified_code": "🗜️ Minified/packed code indicators",
    "suspicious_urls": "⚠️ Suspicious URLs found",
    "external_urls_count": "🔗 Many external URLs in code",
    "env_var_access": "🔑 Reads environment variables (secrets risk)",
    "file_system_read_ops": "📂 Reads sensitive files",
    "file_system_write_ops": "💾 Writes files (dropper behavior)",
    "eval_usage": "⚡ Uses eval() (dynamic execution)",
    "exec_usage": "💻 Uses exec() (dynamic execution)",
    "base64_encoding": "🔤 Base64 usage (hidden payloads)",
}

def main():
    df = pd.read_csv(DATASET_CSV)

    required = ["package_name", "ecosystem", "is_malicious"]
    for c in required:
        if c not in df.columns:
            raise ValueError(f"Missing required column: {c}")

    # One-hot ecosystem (stable for prediction)
    df["eco_is_npm"] = (df["ecosystem"].astype(str).str.lower() == "npm").astype(int)
    df["eco_is_pypi"] = (df["ecosystem"].astype(str).str.lower() == "pypi").astype(int)

    y = df["is_malicious"].astype(int)

    usable = [c for c in FEATURES if c in df.columns]
    X = df[usable + ["eco_is_npm", "eco_is_pypi"]].copy().fillna(0)

    feature_cols = list(X.columns)

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        Xs, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    print(classification_report(y_test, pred, target_names=["SAFE", "MALICIOUS"]))
    print("ROC-AUC:", roc_auc_score(y_test, proba))

    cv = cross_val_score(model, Xs, y, cv=5, scoring="accuracy")
    print("CV accuracy:", [f"{s:.2%}" for s in cv], "Mean:", f"{cv.mean():.2%}")

    artifacts = {
        "model": model,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "feature_explanations": FEATURE_EXPLANATIONS,
    }

    with open(OUT_MODEL, "wb") as f:
        pickle.dump(artifacts, f)

    with open("feature_cols.json", "w", encoding="utf-8") as f:
        json.dump(feature_cols, f, indent=2)

    print(f"✅ Saved model -> {OUT_MODEL}")
    print(f"✅ Feature count used -> {len(feature_cols)}")

if __name__ == "__main__":
    main()
