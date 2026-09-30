# Operating Systems, Cycle by Cycle — A Visual Field Guide

An interactive, technical field guide to operating systems fundamentals, inspired by [*LLMs, Token by Token*](https://a2z-llm-fundamentals.vercel.app/).

Synthesized from the foundational canon of operating systems education:
- **OSTEP (Operating Systems: Three Easy Pieces)** by Remzi & Andrea Arpaci-Dusseau
- **Modern Operating Systems** by Andrew S. Tanenbaum & Herbert Bos
- **Operating System Concepts (The Dinosaur Book)** by Silberschatz, Galvin & Gagne
- **MIT 6.S081 / xv6** & **UC Berkeley CS 162**
- **Modern 2026 Systems Realities**: eBPF, `io_uring`, cgroups v2, NUMA, NVMe Flash FTL, and KPTI.

---

## 🚀 Live Deployments

- **Live Preview URL**: [https://temporary-zippy-zither-nv98337.vercel.app](https://temporary-zippy-zither-nv98337.vercel.app)
- **Claim Link (to bind to your Vercel account permanently)**: [Claim Deployment](https://vercel.com/claim-deployment?code=598ad05b-83a9-46a7-8461-152db03299c6)

---

## 🛠️ Local Development

Zero build step or bundler required. Run any static HTTP server:

```bash
# Python 3
python3 -m http.server 8080

# Or Node.js
npx serve .
```

Open `http://localhost:8080` in any modern web browser.

---

## 📦 Project Structure

```
├── index.html               # 29 chapters across 4 parts with responsive sticky TOC
├── assets/
│   ├── style.css            # Systems design tokens, light/dark themes, responsive layout
│   ├── core.js              # Canvas lifecycle engine, theme sync, high-DPI scaling, UI controls
│   ├── viz-cpu.js           # CPU scheduler, Dual-mode trap stepper, PCB lifecycle, MLFQ, MESI
│   ├── viz-memory.js        # Address translation, TLB, multi-level page tables, LRU arena, COW
│   ├── viz-concurrency.js   # Race conditions, producer-consumer queues, dining philosophers
│   └── viz-systems.js       # DMA transfer pipeline, Flash SSD FTL, Inodes, io_uring, latency pyramid
```

---

## 🚢 Permanent Deployment Options

### 1. Vercel (Production)
```bash
npx vercel login
npx vercel --prod
```

### 2. GitHub Pages
```bash
git remote add origin https://github.com/<your-username>/a2z-os-fundamentals.git
git push -u origin main
# In GitHub Repo Settings -> Pages -> Source: Deploy from branch 'main' / root
```

### 3. Docker / Homelab / NAS
```bash
docker run -d --name os-fundamentals -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
```
