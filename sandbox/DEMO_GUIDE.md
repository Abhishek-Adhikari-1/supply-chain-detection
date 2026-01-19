# 🎬 Sandbox Demo - Quick Reference Card

## 5-Minute Demo Script

### Setup (Before Demo) ⏱️ 2 mins before

```bash
cd /home/pr4n4y/Hackathon/sandbox
./build_sandbox.sh  # Run once, takes 2-3 minutes
```

### Demo Flow (5 minutes)

#### MINUTE 1: The Problem

**SAY**:
> "Companies install hundreds of packages daily. One malicious update can compromise everything. Traditional tools only check known signatures - they miss new attacks. We need to see what packages actually DO."

**SHOW**: Project structure

```bash
ls -la ../sus_packages/
# Show: auth-helper, crypto-miner, py_backdoor
```

---

#### MINUTE 2: The Solution

**SAY**:
> "Our sandbox runs packages in complete isolation and watches their behavior in real-time. It's like a security camera for code."

**SHOW**: Architecture diagram

```bash
cat ARCHITECTURE.txt | head -40
```

---

#### MINUTE 3: Live Demo - Malicious Package

**SAY**:
> "Let's test 'auth-helper' - looks innocent, just a minor version bump. Let's see what it really does."

**RUN**:

```bash
./run_sandbox.sh sus_packages/auth-helper npm 30
```

**HIGHLIGHT** (while running):

- "Creating isolated container..."
- "Installing package..."
- "Executing code..."
- "Monitoring all activity..."

---

#### MINUTE 4: Results Analysis

**SAY**:
> "In 30 seconds, our sandbox caught multiple threats that static analysis would miss."

**SHOW** results:

```bash
cat results/*_analysis.json | jq '{
  risk_score: .risk_score,
  verdict: .verdict,
  findings: .findings[0:2] | map(.message)
}'
```

**POINT OUT**:

```text
✓ Connected to suspicious IP: 45.142.212.61
✓ Attempted SSH key theft
✓ Accessed environment variables
✓ Risk Score: 96/100 - CRITICAL
✓ Verdict: MALICIOUS - AUTO-BLOCKED
```

---

#### MINUTE 5: Impact & Integration

**SAY**:
> "This is what makes our solution unique - we don't just analyze code patterns, we execute and observe actual behavior."

**SHOW** integration:

```bash
cat example_integration.py | head -50
```

**KEY POINTS**:

1. **Hybrid Approach**: Static analysis (fast) + Sandbox (accurate)
2. **Automated Response**: BLOCK (≥70), REVIEW (40-69), ALLOW (<40)
3. **Zero-Day Protection**: Catches unknown attacks
4. **Production Ready**: Docker-based, scales horizontally

**CLOSING**:
> "Traditional tools: Missed this attack.
> Our system: Blocked before installation.
> Supply Chain Guardian - Because trust isn't enough."

---

## 🎯 Key Demo Talking Points

### Why Sandbox?

- ✅ **Actual Behavior** vs code patterns
- ✅ **Zero-Day Detection** - works on unknown attacks
- ✅ **High Confidence** - saw what package actually did
- ✅ **Clear Evidence** - specific IPs, files, actions

### Technical Highlights

- 🔒 **Complete Isolation** - Docker + network-none + read-only
- 📊 **Multi-Layer Monitoring** - Network + Files + Execution
- 🤖 **Smart Scoring** - Weighted risk calculation
- ⚡ **Fast** - Results in 30-60 seconds

### Business Value

- 💰 **Prevent Breaches** - Stop attacks before they happen
- ⚙️ **Automation** - No manual review for clear threats
- 📈 **Scalability** - Container-based, parallel execution
- 🔍 **Transparency** - Clear explanation of threats

---

## 🚨 Live Demo Commands

### Quick Test (Recommended)

```bash
# Single package test with full output
./run_sandbox.sh sus_packages/auth-helper npm 30
```

### Batch Test (If time permits)

```bash
# Test all packages
./test_all.sh
```

### Show Results

```bash
# Summary
ls -lh results/

# Risk scores only
cat results/*_analysis.json | jq '.risk_score'

# Full report
cat results/*_analysis.json | jq
```

---

## 📊 Expected Results for Demo Packages

### auth-helper

- **Risk Score**: 90-96 / 100
- **Verdict**: MALICIOUS
- **Key Findings**:
  - Connects to 45.142.212.61 (data exfiltration)
  - Accesses SSH keys
  - Reads environment variables

### crypto-miner

- **Risk Score**: 75-85 / 100
- **Verdict**: MALICIOUS
- **Key Findings**:
  - High CPU usage
  - Network connections to mining pool
  - Background process

### py_backdoor

- **Risk Score**: 80-90 / 100
- **Verdict**: MALICIOUS
- **Key Findings**:
  - Opens network socket
  - Listens for commands
  - Executes arbitrary code

---

## 🎤 Audience Q&A Prep

### Q: How long does testing take?

**A**: "30-60 seconds per package. Fast enough for CI/CD pipelines."

### Q: What if package needs network?

**A**: "Legitimate packages work without external calls during tests. Malicious ones reveal themselves by trying to phone home."

### Q: Can malware detect the sandbox?

**A**: "Possible, but our multi-layer approach catches suspicious behavior even if package is sandbox-aware. We monitor attempts to detect isolation."

### Q: How do you handle false positives?

**A**: "Risk scoring is tuned conservatively. Medium risk (40-69) goes to manual review. We also whitelist known safe behaviors."

### Q: What about performance at scale?

**A**: "Containers are cheap - we can run 10-20 parallel tests on modest hardware. Cloud deployment enables unlimited scale."

### Q: Integration effort?

**A**: "Python API is 5 lines of code. REST API is 1 HTTP call. Docker makes it platform-agnostic."

---

## 🔧 Troubleshooting During Demo

### Docker not running

```bash
sudo systemctl start docker
```

### Image not built

```bash
./build_sandbox.sh
# Takes 2-3 minutes - do before demo!
```

### Container fails

```bash
# Check logs
docker ps -a
docker logs <container_id>

# Quick fix: rebuild
./build_sandbox.sh
```

### Results not showing

```bash
# Check permissions
ls -la results/
chmod 755 results/ logs/

# Check files exist
ls results/*.json
```

---

## 🎓 Backup Demos (If Main Demo Fails)

### Plan B: Pre-recorded Results

```bash
# Show existing results (run tests before demo as backup)
cat results/auth-helper_*_analysis.json | jq
```

### Plan C: Architecture Explanation

```bash
# Show architecture diagram
cat ARCHITECTURE.txt

# Show code structure
ls -la *.py
cat behavior_analyzer.py | head -100
```

### Plan D: Integration Code

```bash
# Show how easy integration is
cat sandbox_controller.py | grep "def test_package" -A 30
cat example_integration.py
```

---

## 🏆 Demo Success Checklist

**Before Demo**:

- [ ] Docker installed and running
- [ ] Sandbox image built (`./build_sandbox.sh`)
- [ ] Test run completed successfully
- [ ] Results directory has data (as backup)
- [ ] Terminal font size readable
- [ ] No sensitive data in terminal history

**During Demo**:

- [ ] Clear, loud speaking
- [ ] Show command before running
- [ ] Explain what's happening
- [ ] Highlight key findings
- [ ] Connect to business value

**Key Messages**:

- [ ] "Actual behavior, not just code patterns"
- [ ] "Catches zero-day attacks"
- [ ] "Automatic blocking for high-risk"
- [ ] "Production-ready, scales easily"

---

## 📸 Screenshot Moments

1. Running `./run_sandbox.sh` - shows isolation
2. Live monitoring output - shows detection
3. Final report with risk score - shows results
4. Code showing integration - shows ease of use

---

## 🎯 Judging Criteria Alignment

### Innovation

✓ Sandbox execution for package security (not just static analysis)
✓ Hybrid approach (static + dynamic)
✓ Real-time behavior monitoring

### Technical Merit

✓ Docker isolation with security hardening
✓ Multi-layer monitoring (network, files, execution)
✓ Sophisticated risk scoring algorithm
✓ Production-ready architecture

### Completeness

✓ Full working prototype
✓ Multiple test packages
✓ Integration examples
✓ Documentation

### Presentation

✓ Live demo capability
✓ Clear visuals (architecture diagram)
✓ Real results
✓ Business value articulation

---

## 🚀 Post-Demo Follow-up

**If judges want to try**:

```bash
# Let them run it
cd /home/pr4n4y/Hackathon/sandbox
./run_sandbox.sh sus_packages/crypto-miner npm 30
```

**Share resources**:

- Code: GitHub link
- Docs: README.md, IMPLEMENTATION.md
- Architecture: ARCHITECTURE.txt

**Next steps**:

- Open source release
- Add more package types (Ruby, Go, Rust)
- ML model training from sandbox results
- Cloud service offering
