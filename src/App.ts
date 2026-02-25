import h from "hyperscript";
import { MapView } from "./MapView";
import { ShortestPathForm } from "./ShortestPathForm";
import { CollapseList } from "./CollapseList";
import { interfloorShortestPath, shortestPath } from "./getShortestPath";
import { floors } from "./floors";
import { mapConstructNameToPoint } from "./mapConstructNameToPoint";
import { mapPointToConstructName } from "./mapPointToConstructName";
import { liftPositions, liftPositionsReverseMap } from "./liftPositions";
import { TravelingSalesman } from "./TravelingSalesman";
import { getFloor, stripFloor } from "./candidates";
import { generateRandomString } from "./generateRandomString";
import { solveTravelingSalesman } from "./solveTravelingSalesman";
import { CollaborativePage } from "./CollaborativePage";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

const MapViewPage = (
  onExit?: () => void,
  onOpenCollaborative?: (payload: { entityId: string; label: string }) => void
) => {
  const root = h("div");
  let selectedConstruct: { floor: number; constructName: string } | null = null;
  let mapEntity: any = null;
  let comments: any[] = [];
  let referencingCount = 0;

  const loadMapThread = async () => {
    if (!selectedConstruct) return;
    const url = `${API_BASE}/api/map/entity?constructName=${encodeURIComponent(
      selectedConstruct.constructName
    )}&floor=${selectedConstruct.floor}`;
    const response = await fetch(url);
    const body = await response.json();
    mapEntity = body.entity;
    comments = body.comments;
    referencingCount = body.referencingCount;
  };

  const render = () => {
    root.innerHTML = "";
    const commentNodes =
      comments.length > 0
        ? comments.map((comment) => h("li.mb-1", comment.body))
        : [h("li", "No comments yet.")];

    const mapView = MapView({
      type: "browse",
      onChoose: async (payload) => {
        selectedConstruct = payload;
        await loadMapThread();
        render();
      },
    });

    const selectedTitle = selectedConstruct
      ? `Floor ${selectedConstruct.floor}: ${selectedConstruct.constructName}`
      : "Select a room/stairs on the map";

    const element = h(
      "div.flex.flex-col.items-center.justify-center.min-h-screen",
      { style: "background:#F3F4F6" },
      h(
        "div.bg-white.p-8.rounded-lg.shadow-md.w-full",
        { style: "max-width:72rem" },
        h(
          "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mb-3",
          {
            onclick: () => {
              if (onExit !== undefined) onExit();
            },
          },
          "Exit"
        ),
        h(
          "div.grid.md:grid-cols-3.gap-4",
          h("div.md:col-span-2", mapView.element),
          h(
            "div.border.rounded.p-3.bg-gray-50",
            h("h2.text-lg.font-semibold.mb-2", "Map Collaboration"),
            h("p.text-sm.mb-2", selectedTitle),
            mapEntity
              ? h(
                  "div",
                  h("p.text-xs.mb-2", `Entity ID: ${mapEntity.id}`),
                  h("p.text-xs.mb-2", `Entities referencing this location: ${referencingCount}`),
                  h("h3.font-semibold.mb-2", "Comments"),
                  h("ul.text-sm.list-disc.pl-5.max-h-56.overflow-auto", commentNodes),
                  h(
                    "button.bg-green-600.text-white.px-3.py-2.rounded.w-full.mt-3",
                    {
                      onclick: () => {
                        if (onOpenCollaborative && mapEntity) {
                          onOpenCollaborative({
                            entityId: mapEntity.id,
                            label: selectedTitle,
                          });
                        }
                      },
                    },
                    "Open in HCMIU Collaborative"
                  )
                )
              : h("p.text-sm.text-gray-600", "Click a room or stairs to view discussion thread.")
          )
        )
      )
    );
    root.appendChild(element);
  };

  render();
  return { element: root };
};

const ShortestPathPage = (onExit?: () => void) => {
  let fromField = "";
  let toField = "";

  let currentStage:
    | "form"
    | "choose source on map"
    | "choose destination on map"
    | "show shortest path" = "form";

  const root = h("div");

  const transition = (): null => {
    root.innerHTML = "";
    switch (currentStage) {
      case "form": {
        const shortestPathComponent = ShortestPathForm(
          fromField,
          toField,
          (from, to) => {
            (fromField = from), (toField = to);
          },
          () => {
            shortestPathComponent.cleanup();
            currentStage = "choose source on map";
            transition();
          },
          () => {
            shortestPathComponent.cleanup();
            currentStage = "choose destination on map";
            transition();
          },
          () => {
            shortestPathComponent.cleanup();
            currentStage = "show shortest path";
            transition();
          }
        );
        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" },
          h(
            "div.bg-white.p-8.rounded-lg.shadow-md.w-full.max-w-md",
            h(
              "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mb-3",
              {
                onclick: () => {
                  if (onExit !== undefined) {
                    shortestPathComponent.cleanup();
                    onExit();
                  }
                },
              },
              "Exit"
            ),
            shortestPathComponent.element
          )
        );
        root.appendChild(element);
        return null;
      }
      case "choose source on map":
      case "choose destination on map": {
        let currentlyChosen: string | undefined;

        const cancelButton = h(
          "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mt-3",
          {
            onclick: () => {
              currentStage = "form";
              transition();
            },
          },
          "Cancel"
        );

        const confirmButton = h(
          "button.bg-blue-500.text-white.px-4.py-2.rounded.w-full",
          { style: "display:none" },
          {
            onclick: () => {
              if (currentStage === "choose source on map") {
                fromField = currentlyChosen!;
              } else {
                toField = currentlyChosen!;
              }
              currentStage = "form";
              transition();
            },
          },
          "Confirm"
        );

        const mapView = MapView({
          type: "choose on map",
          onChoose: (x) => {
            currentlyChosen = x;
            (confirmButton as HTMLButtonElement).style.display = "block";
          },
        });
        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" },
          h(
            "div.bg-white.p-8.rounded-lg.shadow-md.w-full",
            { style: "max-width:72rem" },
            mapView.element,
            h("div.mb-3"),
            confirmButton,
            cancelButton
          )
        );
        root.appendChild(element);
        return null;
      }
      case "show shortest path": {
        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" }
        );
        root.appendChild(element);

        let legs: { path: number[]; floor: number }[] = computeLegs(
          fromField,
          toField
        );

        const mapView = MapView({
          type: "display path",
          legs,
          changeLegHook: (changeLeg) => {
            changeLeg(0);
            const list = CollapseList(
              legs.map(({ path, floor }) => {
                if (path.length === 1) {
                  return (
                    "Floor " +
                    (floor + 1) +
                    ": " +
                    (mapPointToConstructName[floor][path[0]] ||
                      liftPositionsReverseMap[path[0]])
                  );
                }
                return (
                  "Floor " +
                  (floor + 1) +
                  ": " +
                  (mapPointToConstructName[floor][path[0]] ||
                    liftPositionsReverseMap[path[0]]) +
                  " to " +
                  (mapPointToConstructName[floor][path[path.length - 1]] ||
                    liftPositionsReverseMap[path[path.length - 1]])
                );
              }),
              (leg) => {
                changeLeg(leg);
              }
            );

            element.appendChild(list.element);
            element.appendChild(h("div.mb-3"));
          },
        });
        element.appendChild(
          h(
            "div.bg-white.p-8.rounded-lg.shadow-md.w-full",
            { style: "max-width:72rem" },
            h(
              "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mb-3",
              {
                onclick: () => {
                  if (onExit !== undefined) onExit();
                },
              },
              "Exit"
            ),
            mapView.element
          )
        );
        return null;
      }
    }
  };

  transition();
  return { element: root };
};

const TravelingSalesmanPage = (onExit?: () => void) => {
  const locations = [{ id: generateRandomString(), value: "" }];
  let currentStage:
    | { type: "form" | "show result" | "hcmiu map pro" }
    | { type: "choose on map"; id: string } = { type: "form" };

  const container = h("div");

  const transition = (): null => {
    container.innerHTML = "";
    switch (currentStage.type) {
      case "form": {
        const travelingSalesman = TravelingSalesman(
          locations,
          undefined,
          (id) => {
            travelingSalesman.cleanup();
            currentStage = { type: "choose on map", id };
            transition();
          },
          undefined,
          undefined,
          () => {
            // the component should have validated the locations
            travelingSalesman.cleanup();
            if (locations.length > 20) currentStage = { type: "hcmiu map pro" };
            else currentStage = { type: "show result" };
            transition();
          }
        );

        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" },
          h(
            "div.bg-white.p-8.rounded-lg.shadow-md.w-full.max-w-md",
            h(
              "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mb-3",
              {
                onclick: () => {
                  travelingSalesman.cleanup();
                  if (onExit !== undefined) onExit();
                },
              },
              "Exit"
            ),
            travelingSalesman.element
          )
        );

        container.appendChild(element);
        return null;
      }
      case "choose on map": {
        let currentlyChosen: string | undefined;

        const cancelButton = h(
          "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mt-3",
          {
            onclick: () => {
              currentStage = { type: "form" };
              transition();
            },
          },
          "Cancel"
        );

        const { id } = currentStage;
        const index = locations.findIndex(
          ({ id: currentId }) => currentId === id
        )!;

        const confirmButton = h(
          "button.bg-blue-500.text-white.px-4.py-2.rounded.w-full",
          { style: "display:none" },
          {
            onclick: () => {
              locations[index].value = currentlyChosen!;
              currentStage = { type: "form" };
              transition();
            },
          },
          "Confirm"
        );

        const mapView = MapView({
          type: "choose on map",
          onChoose: (x) => {
            currentlyChosen = x;
            (confirmButton as HTMLButtonElement).style.display = "block";
          },
        });
        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" },
          h(
            "div.bg-white.p-8.rounded-lg.shadow-md.w-full",
            { style: "max-width:72rem" },
            mapView.element,
            h("div.mb-3"),
            confirmButton,
            cancelButton
          )
        );
        container.appendChild(element);
        return null;
      }
      case "show result": {
        const result = solveTravelingSalesman(
          locations.map(({ value }) => value),
          (a, b) => {
            const legs = computeLegs(a, b);
            return legs.reduce(
              (accumulated, current) => accumulated + current.path.length,
              0
            ) - 1;
          }
        );

        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" }
        );
        container.appendChild(element);

        let legs: { path: number[]; floor: number }[] = [];

        if (result.length === 1) {
          legs.push({
            path: [mapConstructNameToPoint[getFloor(result[0])][stripFloor(result[0])]],
            floor: getFloor(result[0]),
          });
        } else {
          for (let i = 1; i < result.length; i++) {
            for (const leg of computeLegs(result[i - 1], result[i])) {
              legs.push(leg);
            }
          }
        }

        {
          const seen = new Set<string>()
          const newLegs = []
          for (const leg of legs) {
            if (!seen.has(JSON.stringify(leg))) newLegs.push(leg)
            seen.add(JSON.stringify(leg))
          }
          legs = newLegs;
        }

        const mapView = MapView({
          type: "display path",
          legs,
          changeLegHook: (changeLeg) => {
            changeLeg(0);
            const list = CollapseList(
              legs.map(({ path, floor }) => {
                if (path.length === 1) {
                  return (
                    "Floor " +
                    (floor + 1) +
                    ": " +
                    (mapPointToConstructName[floor][path[0]] ||
                      liftPositionsReverseMap[path[0]])
                  );
                }
                return (
                  "Floor " +
                  (floor + 1) +
                  ": " +
                  (mapPointToConstructName[floor][path[0]] ||
                    liftPositionsReverseMap[path[0]]) +
                  " to " +
                  (mapPointToConstructName[floor][path[path.length - 1]] ||
                    liftPositionsReverseMap[path[path.length - 1]])
                );
              }),
              (leg) => {
                changeLeg(leg);
              }
            );

            element.appendChild(list.element);
            element.appendChild(h("div.mb-3"));
          },
        });
        element.appendChild(
          h(
            "div.bg-white.p-8.rounded-lg.shadow-md.w-full",
            { style: "max-width:72rem" },
            h(
              "button.bg-red-500.text-white.px-4.py-2.rounded.w-full.mb-3",
              {
                onclick: () => {
                  if (onExit !== undefined) onExit();
                },
              },
              "Exit"
            ),
            mapView.element
          )
        );
        return null;
      }
      case "hcmiu map pro": {
        const element = h(
          "div.flex.flex-col.items-center.justify-center.min-h-screen",
          { style: "background:#F3F4F6" },
          h(
            "div.flex.flex-col.items-center.justify-center",
            h(
              "div.bg-white.p-8.rounded-lg.shadow-md.w-full.max-w-md",
              h("h1.text-xl.mb-4", "HCMIU Map Pro Required"),
              h(
                "p",
                "You chose " +
                  locations.length +
                  " locations, which exceeds the maximum limit of 20 in HCMIU Map Free."
              ),
              h(
                "p.mb-2",
                "The traveling salesman problem is an NP-hard problem. Solving this problem for more than 20 locations requires lots of computing resources and engineering expertise."
              ),
              h(
                "p.mb-2",
                "With HCMIU Map Pro, you gain access to a dedicated engineering team with proven expertise in the traveling salesman problem, as well as powerful servers to solve the problem for your chosen locations."
              ),
              h(
                "p.mb-2",
                "In order to buy HCMIU Map Pro, you must be a 5 Good Student and your GPA must be above 99. HCMIU Map Pro is sold at the price of 1000 VND as long as the previously mentioned conditions are met."
              ),
              h(
                "p",
                "Contact the Cartographers team of the Data Structures and Algorithms course to buy HCMIU Map Pro."
              ),
              h(
                "button.bg-blue-500.text-white.px-4.py-2.rounded.w-full.mt-3",
                {
                  onclick: () => {
                    currentStage = { type: "form" };
                    transition();
                  },
                },
                "Go Back"
              )
            )
          )
        );

        container.appendChild(element);
        return null;
      }
    }
  };
  transition();
  return { element: container };
};

const LandingPage = (
  onClickViewMap?: () => void,
  onClickFindShortestPath?: () => void,
  onClickSolveTravelingSalesman?: () => void,
  onClickCollaborative?: () => void
) => {
  const primaryActions = [
    {
      icon: "🗺️",
      title: "View Map",
      subtitle: "Explore floors, rooms, gates, and key facilities at a glance.",
      className: "bg-blue-500",
      onClick: () => {
        if (onClickViewMap !== undefined) onClickViewMap();
      },
    },
    {
      icon: "🧭",
      title: "Find Shortest Path",
      subtitle: "Compute the quickest route between two places across floors.",
      className: "bg-blue-500",
      onClick: () => {
        if (onClickFindShortestPath !== undefined) onClickFindShortestPath();
      },
    },
    {
      icon: "📍",
      title: "Solve Traveling Salesman",
      subtitle: "Optimize multi-stop routes with smart path ordering.",
      className: "bg-blue-500",
      onClick: () => {
        if (onClickSolveTravelingSalesman !== undefined) onClickSolveTravelingSalesman();
      },
    },
    {
      icon: "🤝",
      title: "HCMIU Collaborative",
      subtitle: "Open community-powered discussions tied directly to map entities.",
      className: "bg-green-600",
      onClick: () => {
        if (onClickCollaborative !== undefined) onClickCollaborative();
      },
    },
  ];

  const element = h(
    "div.flex.flex-col.items-center.justify-center.min-h-screen",
    h(
      "div.w-full.max-w-6xl.grid.gap-5",
      h(
        "div.bg-white.p-8.w-full",
        h("p.text-xs.tracking-widest.uppercase.text-center.mb-3", "HCMIU Campus Intelligence"),
        h(
          "h1.text-3xl.md:text-4xl.font-bold.text-center.mb-2",
          h("span.mr-2", "🏛️"),
          "HCMIU Map Platform"
        ),
        h(
          "p.text-center.text-sm.md:text-base.max-w-3xl.mx-auto",
          "A refined navigation and collaboration workspace for routes, points of interest, and collective campus knowledge."
        ),
        h(
          "div.grid.grid-cols-2.md:grid-cols-4.gap-3.mt-6",
          h(
            "div.border.border-slate-400/30.rounded-xl.p-3.text-center",
            h("p.text-xs.uppercase.tracking-wide.text-slate-300", "Floors"),
            h("p.text-xl.font-semibold", "7")
          ),
          h(
            "div.border.border-slate-400/30.rounded-xl.p-3.text-center",
            h("p.text-xs.uppercase.tracking-wide.text-slate-300", "Pathfinding"),
            h("p.text-xl.font-semibold", "Realtime")
          ),
          h(
            "div.border.border-slate-400/30.rounded-xl.p-3.text-center",
            h("p.text-xs.uppercase.tracking-wide.text-slate-300", "Collaboration"),
            h("p.text-xl.font-semibold", "Integrated")
          ),
          h(
            "div.border.border-slate-400/30.rounded-xl.p-3.text-center",
            h("p.text-xs.uppercase.tracking-wide.text-slate-300", "Experience"),
            h("p.text-xl.font-semibold", "Professional")
          )
        )
      ),
      h(
        "div.bg-white.p-6.w-full",
        h("h2.text-lg.font-semibold.mb-4", "Launchpad"),
        h(
          "div.grid.md:grid-cols-2.gap-3",
          ...primaryActions.map((action) =>
            h(
              `button.${action.className}.text-white.px-5.py-4.w-full.text-left`,
              { onclick: action.onClick },
              h("p.text-base.font-semibold", h("span.mr-2", action.icon), action.title),
              h("p.text-xs.opacity-90.mt-1", action.subtitle)
            )
          )
        ),
        h(
          "button.bg-blue-500.text-white.px-5.py-4.w-full.mt-3.text-left",
          {
            onclick: () => {
              window.open("https://github.com/huynhtrankhanh/hcmiu-map", "_blank", "noreferrer");
            },
          },
          h("p.text-base.font-semibold", h("span.mr-2", "💻"), "Source Code"),
          h("p.text-xs.opacity-90.mt-1", "Review implementation details, architecture, and contribution history.")
        )
      ),
      h(
        "div.bg-white.p-5.w-full",
        h("p.text-sm", "Tip: Start with ", h("span.font-semibold", "View Map"), " to inspect entities, then continue in ", h("span.font-semibold", "HCMIU Collaborative"), ".")
      )
    )
  );
  return { element };
};

export const App = () => {
  let collaborativeFocus: { entityId: string; label: string } | null = null;
  let currentPage:
    | "landing"
    | "map view"
    | "shortest path"
    | "traveling salesman"
    | "collaborative" = "landing";
  const element = h("div");
  const transition = (): null => {
    const exit = () => {
      currentPage = "landing";
      transition();
    };

    element.innerHTML = "";
    switch (currentPage) {
      case "landing": {
        element.appendChild(
          LandingPage(
            () => {
              currentPage = "map view";
              transition();
            },
            () => {
              currentPage = "shortest path";
              transition();
            },
            () => {
              currentPage = "traveling salesman";
              transition();
            },
            () => {
              currentPage = "collaborative";
              transition();
            }
          ).element
        );
        return null;
      }
      case "map view": {
        element.appendChild(
          MapViewPage(exit, (payload) => {
            collaborativeFocus = payload;
            currentPage = "collaborative";
            transition();
          }).element
        );
        return null;
      }
      case "shortest path": {
        element.appendChild(ShortestPathPage(exit).element);
        return null;
      }
      case "traveling salesman": {
        element.appendChild(TravelingSalesmanPage(exit).element);
        return null;
      }
      case "collaborative": {
        element.appendChild(
          CollaborativePage(exit, {
            focusedEntityId: collaborativeFocus?.entityId,
            focusedEntityLabel: collaborativeFocus?.label,
          }).element
        );
        return null;
      }
    }
  };
  transition();
  return { element };
};
function computeLegs(fromField: string, toField: string) {
  let legs: { path: number[]; floor: number }[] = [];

  if (getFloor(fromField) === getFloor(toField)) {
    const floor = getFloor(fromField);
    const point1 =
      mapConstructNameToPoint[floor][stripFloor(fromField)] !== undefined
        ? mapConstructNameToPoint[floor][stripFloor(fromField)]
        : liftPositions[stripFloor(fromField)];
    const point2 =
      mapConstructNameToPoint[floor][stripFloor(toField)] !== undefined
        ? mapConstructNameToPoint[floor][stripFloor(toField)]
        : liftPositions[stripFloor(toField)];
    legs = [{ floor, path: shortestPath(floors[floor].graph, point1, point2) }];
  } else {
    const floor1 = getFloor(fromField);
    const floor2 = getFloor(toField);
    const point1 =
      mapConstructNameToPoint[floor1][stripFloor(fromField)] !== undefined
        ? mapConstructNameToPoint[floor1][stripFloor(fromField)]
        : liftPositions[stripFloor(fromField)];
    const point2 =
      mapConstructNameToPoint[floor2][stripFloor(toField)] !== undefined
        ? mapConstructNameToPoint[floor2][stripFloor(toField)]
        : liftPositions[stripFloor(toField)];
    const computed = interfloorShortestPath(
      floors[floor1].graph,
      floors[floor2].graph,
      point1,
      point2
    );
    if (computed !== undefined) {
      const [leg1, leg2] = computed;
      legs = [
        { path: leg1, floor: floor1 },
        { path: leg2, floor: floor2 },
      ];
    }
  }
  return legs;
}
