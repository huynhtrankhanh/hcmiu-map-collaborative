import h from "hyperscript";
import { floors } from "./floors";
import { createLine, labelAt } from "./superimpose";
import { points } from "./points";

type MapViewApi = {
  focusConstruct: (floorIndex: number, constructName: string) => void;
  resetZoom: () => void;
  setScale: (scale: number) => void;
  setFloor: (floorIndex: number) => void;
};

export const MapView = (
  config?:
    | ({
        type: "choose on map";
        onChoose: (constructName: string) => void;
        onReady?: (api: MapViewApi) => void;
      })
    | ({
        type: "browse";
        onChoose: (payload: { constructName: string; floor: number }) => void;
        onReady?: (api: MapViewApi) => void;
      })
    | ({
        type: "display path";
        legs: { floor: number; path: number[] }[];
        changeLegHook: (legChanger: (x: number) => void) => void;
        onReady?: (api: MapViewApi) => void;
      })
) => {
  let currentFloor: number = 0;
  let currentScale = 100;
  let floorSelector: HTMLSelectElement | null = null;

  const mapElement = h("div.relative", {
    style: "width:953.31px;height:452px",
  });

  const syncFloorSelector = () => {
    if (floorSelector) floorSelector.value = String(currentFloor);
  };
  const setFloorIndex = (floorIndex: number) => {
    currentFloor = Math.max(0, Math.min(floors.length - 1, floorIndex));
    syncFloorSelector();
    renderCurrentFloor();
  };

  const renderCurrentFloor = () => {
    mapElement.innerHTML = "";
    mapElement.appendChild(floors[currentFloor].element());
    const selectConstruct = (construct: Element) => {
      mapElement.querySelectorAll("[data-constructselected]").forEach((x: Element) => {
        x.removeAttribute("data-constructselected");
        (x as HTMLDivElement).style.fontWeight = "";
        (x as HTMLDivElement).style.textDecoration = "";
      });
      construct.setAttribute("data-constructselected", "");
      (construct as HTMLDivElement).style.fontWeight = "bold";
      (construct as HTMLDivElement).style.textDecoration = "underline";
    };
    if (config?.type === "choose on map") {
      mapElement.querySelectorAll("[data-isconstruct]").forEach((construct: Element) => {
        construct.addEventListener("click", () => {
          config.onChoose(
            "Floor " +
              (currentFloor + 1) +
              ": " +
              construct.getAttribute("data-constructname")!
          );
          selectConstruct(construct);
        });
      });
    }
    if (config?.type === "browse") {
      mapElement.querySelectorAll("[data-isconstruct]").forEach((construct: Element) => {
        construct.addEventListener("click", () => {
          selectConstruct(construct);
          config.onChoose({
            constructName: construct.getAttribute("data-constructname")!,
            floor: currentFloor + 1,
          });
        });
      });
      mapElement.querySelectorAll("[data-isstairs]").forEach((stairs: Element) => {
        stairs.addEventListener("click", () => {
          config.onChoose({ constructName: "STAIRS", floor: currentFloor + 1 });
        });
        (stairs as HTMLDivElement).style.cursor = "pointer";
      });
    }
  };

  renderCurrentFloor();

  const applyScale = () => {
    (mapElement as HTMLDivElement).style.transform = "scale(" + currentScale / 100 + ")";
    (mapElement as HTMLDivElement).style.transformOrigin = "top left";
  };

  const focusConstruct = (floorIndex: number, constructName: string) => {
    if (Number.isFinite(floorIndex)) {
      setFloorIndex(floorIndex);
    }
    const target = mapElement.querySelector(`[data-constructname="${constructName}"]`);
    if (target) {
      (target as HTMLDivElement).setAttribute("data-constructselected", "");
      (target as HTMLDivElement).style.fontWeight = "bold";
      (target as HTMLDivElement).style.textDecoration = "underline";
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  };

  const resetZoom = () => {
    currentScale = 100;
    applyScale();
  };

  if (config?.type === "display path") {
    const legs = config.legs;

    config.changeLegHook((leg) => {
      setFloorIndex(legs[leg].floor);

      const path = legs[leg].path;

      if (path.length === 1) {
        const label = labelAt(...points[path[0]], "X");
        mapElement.appendChild(label);
        // https://stackoverflow.com/a/52835382
        setTimeout(
          () =>
            label.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "start",
            }),
          0
        );
      }
      let firstLine: HTMLDivElement | undefined;
      for (let i = 1; i < path.length; i++) {
        const line = createLine(...points[path[i - 1]], ...points[path[i]]);
        if (!firstLine) firstLine = line;
        mapElement.appendChild(line);
      }
      // https://stackoverflow.com/a/52835382
      setTimeout(
        () =>
          firstLine?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "start",
          }),
        0
      );
    });
  }

  applyScale();

  config?.onReady?.({
    focusConstruct,
    resetZoom,
    setScale: (scale: number) => {
      currentScale = scale;
      applyScale();
    },
    setFloor: (floorIndex: number) => {
      setFloorIndex(floorIndex);
    },
  });

  const element = h(
    "div",
    h(
      "div.mb-6",
      h(
        "select.block.appearance-none.w-full.border.py-3.px-4.pr-8.rounded.leading-tight.focus:outline-none.focus:bg-white.focus:border-[#6B7280]",
        {
          name: "floor",
          onchange: (event: Event) => {
            setFloorIndex(Number((event.target as HTMLSelectElement).value));
          },
          style:
            config?.type === "display path" ? "display:none" : "display:block",
        },
        h("option", { value: "0" }, "Floor 1"),
        h("option", { value: "1" }, "Floor 2"),
        h("option", { value: "2" }, "Floor 3"),
        h("option", { value: "3" }, "Floor 4"),
        h("option", { value: "4" }, "Floor 5"),
        h("option", { value: "5" }, "Floor 6"),
        h("option", { value: "6" }, "Floor 7")
      )
    ),
    h(
      "input.mb-6.w-full.h-2.bg-[#D1D5DB].rounded.outline-none.opacity-50.transition-opacity.duration-200.hover:opacity-100",
      {
        min: "50",
        max: "200",
        type: "range",
        value: "100",
        oninput: (event: Event) => {
          const scale = Number((event.target as HTMLInputElement).value);
          currentScale = scale;
          applyScale();
        },
      }
    ),
    h("div.overflow-auto", mapElement)
  );
  floorSelector = element.querySelector("select[name='floor']") as HTMLSelectElement | null;
  syncFloorSelector();

  return { element };
};
