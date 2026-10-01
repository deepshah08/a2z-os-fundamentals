/* ==========================================================================
   Operating Systems, Cycle by Cycle — Virtual Memory Visualizations (viz-memory.js)
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 1. Virtual-to-Physical Address Translator
   * -------------------------------------------------------------------------- */
  OS.register('addressTranslation', function (host) {
    let vAddr = 0x1A4C; // 16-bit address with 4KB pages (VPN: 4 bits, Offset: 12 bits)
    const pageTable = [
      { pfn: 0x7, present: 1, write: 1, user: 1 }, // VPN 0
      { pfn: 0xC, present: 1, write: 1, user: 1 }, // VPN 1
      { pfn: 0x0, present: 0, write: 0, user: 0 }, // VPN 2 (Not present / swap)
      { pfn: 0x3, present: 1, write: 0, user: 1 }, // VPN 3 (Read-only)
    ];

    const controls = OS.controls(host);
    const select = OS.select(controls, {
      id: 'vaddr-select',
      label: 'Virtual Address:',
      options: [
        { label: '0x1A4C (VPN: 1, Offset: 0xA4C)', value: 0x1A4C },
        { label: '0x0250 (VPN: 0, Offset: 0x250)', value: 0x0250 },
        { label: '0x2100 (VPN: 2, Page Fault!)', value: 0x2100 },
        { label: '0x3FFF (VPN: 3, Offset: 0xFFF)', value: 0x3FFF }
      ],
      value: vAddr,
      onChange: (v) => { vAddr = isNaN(parseInt(v)) ? 0x1A4C : parseInt(v); render(); }
    });

    const cv = OS.canvas(host, {
      height: 210,
      label: 'Virtual to physical address translation',
      draw: (ctx, w, h) => {
        const vpn = (vAddr >> 12) & 0xF;
        const offset = vAddr & 0xFFF;
        const pte = pageTable[vpn] || { pfn: 0, present: 0, write: 0, user: 0 };
        const pAddr = (pte.pfn << 12) | offset;

        // Top: Virtual Address breakdown
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 2;
        ctx.roundRect(25, 20, 160, 45, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.teal;
        ctx.roundRect(195, 20, 200, 45, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText(`VPN: 0x${vpn.toString(16).toUpperCase()}`, 35, 38);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('(Virtual Page Number)', 35, 54);

        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText(`Offset: 0x${offset.toString(16).toUpperCase().padStart(3, '0')}`, 205, 38);
        ctx.font = OS.font(10, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('(Identical in Physical Frame)', 205, 54);

        // Middle: Page Table Lookup
        const ptY = 85;
        ctx.fillStyle = pte.present ? OS.rgba(OS.C.teal, 0.12) : OS.rgba(OS.C.rose, 0.12);
        ctx.strokeStyle = pte.present ? OS.C.teal : OS.C.rose;
        ctx.lineWidth = 1.5;
        ctx.roundRect(25, ptY, w - 50, 46, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = pte.present ? OS.C.teal : OS.C.rose;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText(`PTE[${vpn}]: PFN = 0x${pte.pfn.toString(16).toUpperCase()} | Present=${pte.present} | Writable=${pte.write} | User=${pte.user}`, 35, ptY + 28);

        // Bottom: Physical Address Generation
        const paY = 150;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = pte.present ? OS.C.green : OS.C.line;
        ctx.lineWidth = 2;
        ctx.roundRect(25, paY, w - 50, 45, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = pte.present ? OS.C.green : OS.C.rose;
        ctx.font = OS.font(13, 'mono', 600);
        if (pte.present) {
          ctx.fillText(`PHYSICAL ADDRESS = 0x${pAddr.toString(16).toUpperCase().padStart(4, '0')} (PFN: 0x${pte.pfn.toString(16).toUpperCase()} + Offset: 0x${offset.toString(16).toUpperCase()})`, 35, paY + 28);
        } else {
          ctx.fillText('PAGE FAULT TRAP EXCEPTION (Page not present in physical RAM; must swap in)', 35, paY + 28);
        }
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      const vpn = (vAddr >> 12) & 0xF;
      const offset = vAddr & 0xFFF;
      const pte = pageTable[vpn];
      if (pte.present) {
        readout.innerHTML = `<b>Status:</b> <span class="hl">Translation Successful</span>. Virtual Address <code>0x${vAddr.toString(16).toUpperCase()}</code> mapped to Physical RAM Frame <code>0x${pte.pfn.toString(16).toUpperCase()}</code>, Physical Address: <code>0x${((pte.pfn << 12) | offset).toString(16).toUpperCase()}</code>.`;
      } else {
        readout.innerHTML = `<b>Status:</b> <span style="color:var(--rose); font-weight:600">PAGE FAULT!</span> VPN ${vpn} has Present bit = 0. Hardware MMU raises interrupt 14. Kernel page fault handler will read page from swap/disk.`;
      }
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 2. The TLB (Translation Lookaside Buffer) Hit/Miss Simulator
   * -------------------------------------------------------------------------- */
  OS.register('tlb', function (host) {
    let tlbEntries = [
      { vpn: 0x10, pfn: 0xA2, asid: 1, valid: 1 },
      { vpn: 0x14, pfn: 0xB5, asid: 1, valid: 1 },
      { vpn: 0x22, pfn: 0x3F, asid: 1, valid: 1 }
    ];
    let lastQuery = 0x10;
    let lastResult = 'HIT';
    let cycles = 1;

    const controls = OS.controls(host);
    OS.button(controls, 'Access VPN 0x10 (Hit)', () => {
      lastQuery = 0x10;
      lastResult = 'HIT (1 CPU Cycle)';
      cycles = 1;
      render();
    });
    OS.button(controls, 'Access VPN 0x14 (Hit)', () => {
      lastQuery = 0x14;
      lastResult = 'HIT (1 CPU Cycle)';
      cycles = 1;
      render();
    });
    OS.button(controls, 'Access VPN 0x58 (Miss)', () => {
      lastQuery = 0x58;
      lastResult = 'MISS (Page Table Walk: ~100 Cycles)';
      cycles = 100;
      // Evict oldest and insert
      tlbEntries.pop();
      tlbEntries.unshift({ vpn: 0x58, pfn: 0xCC, asid: 1, valid: 1 });
      render();
    });
    OS.button(controls, 'Context Switch (Flush TLB)', () => {
      tlbEntries.forEach(e => { e.valid = 0; });
      lastResult = 'FLUSHED (All Valid bits cleared)';
      cycles = 0;
      render();
    });

    const cv = OS.canvas(host, {
      height: 190,
      label: 'TLB cache lookups',
      draw: (ctx, w, h) => {
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.lineWidth = 1;
        ctx.roundRect(25, 20, w - 50, 110, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('HARDWARE MMU — TRANSLATION LOOKASIDE BUFFER (TLB)', 35, 42);

        // Render TLB slots
        const slotW = Math.min(180, (w - 100) / 3);
        tlbEntries.forEach((e, i) => {
          const sx = 35 + i * (slotW + 15);
          ctx.fillStyle = e.valid ? OS.rgba(OS.C.teal, 0.1) : OS.rgba(OS.C.faint, 0.1);
          ctx.strokeStyle = e.valid ? OS.C.teal : OS.C.line;
          ctx.lineWidth = 1.5;
          ctx.roundRect(sx, 55, slotW, 60, 6);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = OS.C.ink;
          ctx.font = OS.font(11, 'mono', 500);
          ctx.fillText(`VPN: 0x${e.vpn.toString(16).toUpperCase()}`, sx + 8, 75);
          ctx.fillText(`PFN: 0x${e.pfn.toString(16).toUpperCase()}`, sx + 8, 92);
          ctx.fillStyle = e.valid ? OS.C.green : OS.C.rose;
          ctx.fillText(`Valid: ${e.valid}`, sx + 8, 108);
        });

        // Result banner
        ctx.fillStyle = lastResult.startsWith('HIT') ? OS.C.green : (lastResult.startsWith('MISS') ? OS.C.rose : OS.C.muted);
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText(`Last Lookup: VPN 0x${lastQuery.toString(16).toUpperCase()} → Result: ${lastResult}`, 35, 155);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>TLB Hit Rate Equation:</b> <code>Effective Access Time = Hit_Rate × TLB_Time + (1 − Hit_Rate) × (TLB_Time + Memory_Walk_Time)</code><br>
        With a 99% TLB hit rate, effective memory latency drops from 100ns to ~1.9ns.
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 3. Multi-Level Page Table Tree Walker
   * -------------------------------------------------------------------------- */
  OS.register('multiLevel', function (host) {
    const controls = OS.controls(host);
    let viewMode = 'sparse';

    OS.segmented(controls, {
      label: 'Memory Layout',
      options: [
        { label: 'Sparse Allocation (Typical Process: Code + Stack)', value: 'sparse' },
        { label: 'Dense Allocation (Full Memory Utilization)', value: 'dense' }
      ],
      value: viewMode,
      onChange: (v) => { viewMode = v; render(); }
    });

    const cv = OS.canvas(host, {
      height: 200,
      label: 'Multi level page table tree',
      draw: (ctx, w, h) => {
        // Page Directory Root
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.15);
        ctx.strokeStyle = OS.C.accent;
        ctx.lineWidth = 2;
        ctx.roundRect(25, 30, 160, 140, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('PAGE DIRECTORY (CR3)', 32, 50);

        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('PDE 0 → Page Table 0', 35, 75);
        ctx.fillText('PDE 1 → (Null / Unmapped)', 35, 95);
        ctx.fillText('PDE 2 → (Null / Unmapped)', 35, 115);
        ctx.fillText(viewMode === 'dense' ? 'PDE 3 → Page Table 3' : 'PDE 3 → Page Table 3 (Stack)', 35, 135);
        ctx.fillText('PDE 4..1023 → (All Null)', 35, 155);

        // Second Level Tables
        const ptX = 240;
        // Table 0 (Code/Heap)
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.12);
        ctx.strokeStyle = OS.C.teal;
        ctx.roundRect(ptX, 30, 170, 65, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('PAGE TABLE 0 (Code)', ptX + 10, 50);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('PTEs for VPN 0..1023 (Allocated)', ptX + 10, 72);

        // Table 3 (Stack)
        ctx.fillStyle = OS.rgba(OS.C.violet, 0.12);
        ctx.strokeStyle = OS.C.violet;
        ctx.roundRect(ptX, 105, 170, 65, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.violet;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('PAGE TABLE 3 (Stack)', ptX + 10, 125);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('PTEs for Stack pages (Allocated)', ptX + 10, 147);

        // Memory savings callout
        ctx.fillStyle = OS.C.green;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('Memory Saved vs Linear: > 99.2%', ptX + 195, 95);
        ctx.font = OS.font(11, 'sans', 400);
        ctx.fillStyle = OS.C.muted;
        ctx.fillText('Empty address regions consume zero page tables!', ptX + 195, 115);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      readout.innerHTML = `
        <b>The Multi-Level Paging Trade-off:</b><br>
        A linear 32-bit page table requires <b>4 MB</b> for every single process, even if it only uses 16 KB of code. 
        Multi-level paging allocates sub-tables <i>on demand</i>. Unallocated address space ranges have null PDE pointers, saving gigabytes of physical RAM.
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 4. Page Replacement Arena (FIFO vs LRU vs Clock)
   * -------------------------------------------------------------------------- */
  OS.register('pageReplacement', function (host) {
    const refString = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
    let stepIndex = 0;
    let numFrames = 3;
    let framesFIFO = [];
    let framesLRU = [];
    let framesClock = [];
    let hitsFIFO = 0, faultsFIFO = 0;
    let hitsLRU = 0, faultsLRU = 0;

    const controls = OS.controls(host);
    OS.button(controls, 'Step 1 Reference ▶', () => {
      if (stepIndex < refString.length) {
        stepSimulation();
        stepIndex++;
      }
      render();
    }, { primary: true });

    OS.button(controls, 'Run All References', () => {
      while (stepIndex < refString.length) {
        stepSimulation();
        stepIndex++;
      }
      render();
    });

    OS.button(controls, 'Reset Arena', () => {
      stepIndex = 0;
      framesFIFO = [];
      framesLRU = [];
      framesClock = [];
      hitsFIFO = 0; faultsFIFO = 0;
      hitsLRU = 0; faultsLRU = 0;
      render();
    });

    function stepSimulation() {
      const page = refString[stepIndex];

      // FIFO Logic
      if (framesFIFO.includes(page)) {
        hitsFIFO++;
      } else {
        faultsFIFO++;
        if (framesFIFO.length < numFrames) {
          framesFIFO.push(page);
        } else {
          framesFIFO.shift();
          framesFIFO.push(page);
        }
      }

      // LRU Logic
      if (framesLRU.includes(page)) {
        hitsLRU++;
        // Move to most recently used (end)
        framesLRU = framesLRU.filter(p => p !== page);
        framesLRU.push(page);
      } else {
        faultsLRU++;
        if (framesLRU.length < numFrames) {
          framesLRU.push(page);
        } else {
          framesLRU.shift(); // Evict least recently used
          framesLRU.push(page);
        }
      }
    }

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Page replacement algorithms',
      draw: (ctx, w, h) => {
        // Stream of references at top
        ctx.font = OS.font(11, 'mono', 500);
        let rx = 25;
        const spacing = Math.min(22, Math.max(13, (w - 50) / refString.length));
        refString.forEach((p, i) => {
          ctx.fillStyle = i === stepIndex - 1 ? OS.C.accent : (i < stepIndex ? OS.C.muted : OS.C.faint);
          if (i === stepIndex - 1) {
            ctx.fillRect(rx - 2, 15, spacing - 4, 20);
            ctx.fillStyle = '#ffffff';
          }
          ctx.fillText(p, rx, 30);
          rx += spacing;
        });

        // Frame comparison boxes
        const boxW = Math.min(220, (w - 70) / 2);

        // FIFO Box
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(25, 55, boxW, 85, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('FIFO Policy', 35, 75);
        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Frames: [${framesFIFO.join(', ')}]`, 35, 98);
        ctx.fillText(`Faults: ${faultsFIFO} | Hits: ${hitsFIFO}`, 35, 120);

        // LRU Box
        const lruX = w - 25 - boxW;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(lruX, 55, boxW, 85, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText('LRU Policy', lruX + 10, 75);
        ctx.font = OS.font(11, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Frames: [${framesLRU.join(', ')}]`, lruX + 10, 98);
        ctx.fillText(`Faults: ${faultsLRU} | Hits: ${hitsLRU}`, lruX + 10, 120);
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      const progress = `${stepIndex}/${refString.length}`;
      const lruRate = (hitsLRU + faultsLRU) > 0 ? ((hitsLRU / (hitsLRU + faultsLRU)) * 100).toFixed(1) : '0';
      const fifoRate = (hitsFIFO + faultsFIFO) > 0 ? ((hitsFIFO / (hitsFIFO + faultsFIFO)) * 100).toFixed(1) : '0';

      readout.innerHTML = `
        <b>Progress:</b> ${progress} references processed.<br>
        • <b>FIFO Hit Rate:</b> <span class="hl">${fifoRate}%</span> (${faultsFIFO} page faults)<br>
        • <b>LRU Hit Rate:</b> <span class="hl">${lruRate}%</span> (${faultsLRU} page faults)<br>
        <span style="font-size:0.75rem; color:var(--muted)">Belady's Anomaly Note: Increasing FIFO frames can paradoxically increase page faults, whereas LRU is a stack algorithm immune to this flaw.</span>
      `;
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 5. Copy-on-Write (COW) Simulator
   * -------------------------------------------------------------------------- */
  OS.register('cow', function (host) {
    let childModified = false;

    const controls = OS.controls(host);
    OS.button(controls, 'Parent Calls fork()', () => {
      childModified = false;
      render();
    });
    OS.button(controls, 'Child Writes to Page 2 (Trigger COW)', () => {
      childModified = true;
      render();
    }, { primary: true });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Copy on write mechanism',
      draw: (ctx, w, h) => {
        // Parent PTEs
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.1);
        ctx.strokeStyle = OS.C.accent;
        ctx.roundRect(25, 20, 140, 80, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('PARENT PROCESS', 35, 40);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('PTE 1 → PFN 40 (R/O)', 35, 60);
        ctx.fillText('PTE 2 → PFN 55 (R/O)', 35, 80);

        // Child PTEs
        ctx.fillStyle = OS.rgba(OS.C.teal, 0.1);
        ctx.strokeStyle = OS.C.teal;
        ctx.roundRect(25, 110, 140, 80, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.teal;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('CHILD PROCESS', 35, 130);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText('PTE 1 → PFN 40 (R/O)', 35, 150);
        ctx.fillText(childModified ? 'PTE 2 → PFN 99 (R/W)' : 'PTE 2 → PFN 55 (R/O)', 35, 170);

        // Physical RAM Frames
        const ramX = 220;
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(ramX, 20, w - ramX - 25, 170, 8);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('PHYSICAL RAM FRAMES', ramX + 15, 42);

        // Frame 40
        ctx.fillStyle = OS.rgba(OS.C.accent, 0.15);
        ctx.fillRect(ramX + 15, 55, 120, 30);
        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(10, 'mono', 500);
        ctx.fillText('PFN 40 (Shared R/O)', ramX + 20, 74);

        // Frame 55
        ctx.fillStyle = OS.rgba(OS.C.amber, 0.15);
        ctx.fillRect(ramX + 15, 95, 120, 30);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(childModified ? 'PFN 55 (Parent R/W)' : 'PFN 55 (Shared R/O)', ramX + 20, 114);

        // Frame 99 (New duplicate frame allocated after COW)
        if (childModified) {
          ctx.fillStyle = OS.rgba(OS.C.rose, 0.2);
          ctx.strokeStyle = OS.C.rose;
          ctx.strokeRect(ramX + 15, 135, 150, 30);
          ctx.fillRect(ramX + 15, 135, 150, 30);
          ctx.fillStyle = OS.C.rose;
          ctx.font = OS.font(10, 'mono', 600);
          ctx.fillText('PFN 99 (New Child Copy)', ramX + 20, 154);
        }
      }
    });

    const readout = OS.readout(host);

    function render() {
      cv.redraw();
      if (!childModified) {
        readout.innerHTML = `<b>Zero-Copy Fork:</b> Parent and child share identical physical frames marked <b>Read-Only</b>. No memory is duplicated during <code>fork()</code>, making process creation instantaneous.`;
      } else {
        readout.innerHTML = `<b>Copy-On-Write Triggered:</b> Child attempted to write to Page 2. Hardware MMU detected write to Read-Only PTE and raised Page Fault. Kernel allocated new physical frame (PFN 99), copied Page 2 data, and granted write permissions to child.`;
      }
    }

    render();
  });

  /* --------------------------------------------------------------------------
   * 6. Base & Bound Dynamic Relocation Simulator
   * -------------------------------------------------------------------------- */
  OS.register('baseBounds', function (host) {
    const base = 0x8000;  // 32 KB
    const bound = 0x0400; // 1 KB limit
    let vAddr = 0x0150;   // 336 bytes

    const controls = OS.controls(host);
    const slider = OS.slider(controls, {
      id: 'base-bound-vaddr',
      label: 'Virtual Address:',
      min: 0,
      max: 1500,
      step: 50,
      value: vAddr,
      format: (v) => `0x${v.toString(16).toUpperCase()}`,
      onInput: (v) => { vAddr = v; render(); }
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Base and bound hardware relocation',
      draw: (ctx, w, h) => {
        const isValid = vAddr < bound;
        const pAddr = base + vAddr;

        // Base & Bound Registers Box
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(25, 25, 170, 120, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = OS.C.accent;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText('CPU REGISTERS', 35, 45);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Base:  0x${base.toString(16).toUpperCase()} (32KB)`, 35, 72);
        ctx.fillText(`Bound: 0x${bound.toString(16).toUpperCase()} (1KB)`, 35, 95);
        ctx.fillText(`VAddr: 0x${vAddr.toString(16).toUpperCase()}`, 35, 118);

        // Comparator / ALU
        const aluX = 220;
        ctx.fillStyle = isValid ? OS.rgba(OS.C.green, 0.12) : OS.rgba(OS.C.rose, 0.15);
        ctx.strokeStyle = isValid ? OS.C.green : OS.C.rose;
        ctx.lineWidth = 2;
        ctx.roundRect(aluX, 25, Math.min(300, w - aluX - 25), 120, 6);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = isValid ? OS.C.green : OS.C.rose;
        ctx.font = OS.font(12, 'mono', 600);
        ctx.fillText(isValid ? 'HARDWARE RELOCATION SUCCESS' : 'HARDWARE TRAP: OUT OF BOUNDS!', aluX + 15, 52);
        ctx.font = OS.font(10, 'mono', 400);
        ctx.fillStyle = OS.C.ink;
        if (isValid) {
          ctx.fillText(`Check: VAddr (0x${vAddr.toString(16).toUpperCase()}) < Bound (0x${bound.toString(16).toUpperCase()}) -> OK`, aluX + 15, 80);
          ctx.font = OS.font(12, 'mono', 600);
          ctx.fillStyle = OS.C.accent;
          ctx.fillText(`Physical Addr = 0x${pAddr.toString(16).toUpperCase()} (Base + VAddr)`, aluX + 15, 110);
        } else {
          ctx.fillText(`Check: VAddr (0x${vAddr.toString(16).toUpperCase()}) >= Bound (0x${bound.toString(16).toUpperCase()}) -> VIOLATION`, aluX + 15, 80);
          ctx.font = OS.font(11, 'mono', 600);
          ctx.fillStyle = OS.C.rose;
          ctx.fillText('CPU raises SIGSEGV (Segmentation Fault)', aluX + 15, 110);
        }
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      if (vAddr < bound) {
        readout.innerHTML = `<b>Status:</b> Virtual address <code>0x${vAddr.toString(16).toUpperCase()}</code> is within bound (1024 bytes). Translates to physical RAM address <code>0x${(base + vAddr).toString(16).toUpperCase()}</code>.`;
      } else {
        readout.innerHTML = `<b style="color:var(--rose)">SEGMENTATION FAULT (SIGSEGV):</b> Virtual address <code>0x${vAddr.toString(16).toUpperCase()}</code> exceeds process bound of 1KB (0x400). Hardware immediately halts process execution.`;
      }
    }
    render();
  });

  /* --------------------------------------------------------------------------
   * 7. Working Set & Thrashing Curve Simulator
   * -------------------------------------------------------------------------- */
  OS.register('thrashingCurve', function (host) {
    let workingSetGB = 6;
    const physicalRamGB = 8;

    const controls = OS.controls(host);
    OS.slider(controls, {
      id: 'working-set-slider',
      label: 'Working Set Demand:',
      min: 2,
      max: 20,
      step: 1,
      value: workingSetGB,
      format: (v) => `${v} GB`,
      onInput: (v) => { workingSetGB = v; render(); }
    });

    const cv = OS.canvas(host, {
      height: 180,
      label: 'Working set memory pressure and thrashing curve',
      draw: (ctx, w, h) => {
        const isThrashing = workingSetGB > physicalRamGB;
        const faultRate = isThrashing ? Math.min(100, Math.round(Math.pow((workingSetGB - physicalRamGB), 1.6) * 12 + 10)) : Math.round(workingSetGB * 1.5);
        const cpuUtil = isThrashing ? Math.max(3, Math.round(95 - faultRate * 0.9)) : 95;

        // RAM Capacity Bar
        ctx.fillStyle = OS.C.sunk;
        ctx.strokeStyle = OS.C.line;
        ctx.roundRect(25, 25, w - 50, 40, 6);
        ctx.fill(); ctx.stroke();

        const barFillW = Math.min(w - 50, ((w - 50) * (workingSetGB / 20)));
        ctx.fillStyle = isThrashing ? OS.rgba(OS.C.rose, 0.6) : OS.rgba(OS.C.teal, 0.6);
        ctx.fillRect(25, 25, barFillW, 40);

        ctx.fillStyle = OS.C.ink;
        ctx.font = OS.font(11, 'mono', 600);
        ctx.fillText(`Demand: ${workingSetGB} GB / Physical RAM: ${physicalRamGB} GB`, 35, 49);

        // Metrics Readout Bars
        const mY = 85;
        ctx.font = OS.font(11, 'mono', 500);
        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`CPU Throughput: ${cpuUtil}%`, 25, mY + 15);
        ctx.fillStyle = OS.C.sunk;
        ctx.fillRect(190, mY + 5, w - 215, 14);
        ctx.fillStyle = isThrashing ? OS.C.rose : OS.C.green;
        ctx.fillRect(190, mY + 5, ((w - 215) * cpuUtil) / 100, 14);

        ctx.fillStyle = OS.C.ink;
        ctx.fillText(`Page Fault Rate: ${faultRate}k/s`, 25, mY + 45);
        ctx.fillStyle = OS.C.sunk;
        ctx.fillRect(190, mY + 35, w - 215, 14);
        ctx.fillStyle = isThrashing ? OS.C.rose : OS.C.amber;
        ctx.fillRect(190, mY + 35, ((w - 215) * faultRate) / 100, 14);
      }
    });

    const readout = OS.readout(host);
    function render() {
      cv.redraw();
      if (workingSetGB <= physicalRamGB) {
        readout.innerHTML = `<b>Status: Healthy Paging.</b> Working set (${workingSetGB} GB) fits within physical RAM (${physicalRamGB} GB). CPU utilization is high (~95%) and page faults are negligible.`;
      } else {
        readout.innerHTML = `<b style="color:var(--rose)">CRITICAL: THRASHING DETECTED!</b> Working set (${workingSetGB} GB) exceeds physical RAM (${physicalRamGB} GB). The system spends 97% of time servicing swap page faults. CPU throughput collapses.`;
      }
    }
    render();
  });

})();
