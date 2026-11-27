# Fixture attribution

## Schependomlaan

The original building model is © its original owners and is distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The source is the openBIM standards archive at commit `e6971d897b60f04ea28b4e3f2acf80d05f269197`, file `Design model IFC/IFC Schependomlaan.ifc`. [Source model](https://github.com/openBIMstandards/Archive-DataSetSchependomlaan/blob/e6971d897b60f04ea28b4e3f2acf80d05f269197/Design%20model%20IFC/IFC%20Schependomlaan.ifc) · [Original licence](https://github.com/openBIMstandards/Archive-DataSetSchependomlaan/blob/e6971d897b60f04ea28b4e3f2acf80d05f269197/LICENSE.MD)

We used IfcPatch to extract the selected wall with its required IFC dependencies. `schependomlaan/model.ifc` is that extracted subset. The offline report includes projected geometry derived from it. The full source is fetched separately with its SHA-256 checked by `scripts/fetch_schependomlaan.py`. The comparison was motivated by [OpenAEC's public cross-engine investigation](https://github.com/OpenAEC-Foundation/open-bim-studio/blob/main/spikes/incremental-evaluation/results/compare.md).

## buildingSMART certification wall

`certification-wall.ifc` is the unmodified `wall-with-opening-and-window.ifc` from buildingSMART International Ltd., © buildingSMART International Ltd. and distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The IFC4 sample controls for a millimetre-based model with a wall opening. [Pinned source file](https://github.com/buildingSMART/Certification-datasets/blob/5030f652e85d3e679b392fcb38bfa3328d6d9f79/IFC%204.0.2.1%20%28IFC%204%20ADD2%20TC1%29/ISO%20Spec%20-%20ReferenceView_V1.2/wall-with-opening-and-window.ifc) · [Original licence](https://github.com/buildingSMART/Certification-datasets/blob/5030f652e85d3e679b392fcb38bfa3328d6d9f79/LICENSE)
