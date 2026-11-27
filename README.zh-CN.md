# IFC 几何问题复现器

用两套几何引擎读取同一份 IFC，选定测点，将原模型缩成仍能复现几何差异的小文件。计算和报告均在本机运行。

首个案例来自公开的 Schependomlaan 建筑模型。完整文件含 **3,714 个 IFC 构件**，缩减后只剩 **1 个构件**。同一个测点上，两套引擎的深处交点分别为 **9.10875 米**和 **7.16488 米**。两侧各自的读数在缩减前后保持一致。[案例来源与许可](fixtures/NOTICE.md)

## Open Agentic Web Challenge 参赛版

打开[公开演示](https://aevumworks.github.io/ifc-geometry-repro/)，点击 **Replay the discrepancy** 跟踪 Agent 调用和复现结果。**Verify both controls** 检查 buildingSMART 样例的洞口与实墙位置。两项演示均无需账号或密钥。可点选测点、改坐标并下载证据 JSON。

浏览器先校验小样本的 SHA-256，再用 web-ifc 生成网格，并对这份网格和预先由 IfcOpenShell 生成的网格现场计算交点。重跑完整模型、缩减自己的 IFC 或现场重新生成两套网格，请使用下方命令行工具。[公开 Agent 清单](https://aevumworks.github.io/ifc-geometry-repro/agent-manifest.json)

## 运行

需要 Python 3.12 或 3.13、Node.js 20 以上和 uv。在仓库根目录执行以下命令。

```sh
npm ci
uv sync --locked
uv run --locked python -m ifc_repro replay fixtures/schependomlaan
```

直接在浏览器打开本地 `fixtures/schependomlaan/report.html` 可看交互报告。无需启动服务。报告可以切换叠加图层，点选或输入测点，以及下载测点 JSON。

| 命令 | 用途 |
| --- | --- |
| `list model.ifc` | 列出带几何表示的墙体和 GlobalId，可通过 `--class` 选其他 IFC 类。 |
| `inspect model.ifc GLOBAL_ID --axis y --html preview.html` | 用同一坐标系测两套引擎，生成可点选报告。 |
| `capture model.ifc probe.json captured-case` | 复查每次缩减，输出 IFC、记录和 HTML。 |
| `replay captured-case` | 在锁定的引擎版本上重新验证。 |

各命令前加 `uv run --locked python -m ifc_repro`。测量单位为米。引擎无法输出几何时，命令会返回错误。报告记录局部几何差异，期望值可由调用者在检查时指定。缩减文件仍可能含原项目信息，只分享有权披露的样例。[完整命令及测试](README.md)
