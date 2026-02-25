import "./style.css";
import { App } from "./App";
import h from "hyperscript";
import * as floor1 from "./floor1";
import { points } from "./points";
import { createLine, labelAt } from "./superimpose";
import { shortestPath } from "./getShortestPath";
import anime from "animejs";

const root = document.querySelector<HTMLDivElement>("#app")!;

const showHCMIUFoodBoothTracking = /^\#HCMIUFoodBooth/.test(location.hash);
if (showHCMIUFoodBoothTracking) {
  alert(`Welcome!

Under a contract with the team behind HCMIU Food Booth, we, the Cartographers team agreed to lease the platform to HCMIU Food Booth for the purpose of order tracking.

Have a good time!`);

  const mapElement = h(
    "div.relative",
    {
      style: "width:953.31px;height:452px",
    },
    floor1.element()
  );

  const element = h(
    "div.h-screen.w-screen.flex.items-center.align-center.justify-center",
    mapElement
  );

  const timeline = anime.timeline({ easing: "easeOutExpo", duration: 750 });

  const path = shortestPath(floor1.graph, 5, 55);
  const target = labelAt(...points[path[0]], "DRIVER");

  mapElement.appendChild(target)

  root.appendChild(element);

  for (let i = 1; i < path.length; i++) {
    timeline.add({
      targets: target,
      top: points[path[i]][1],
      left: points[path[i]][0],
      duration: 750
    });

    mapElement.appendChild(
      createLine(...points[path[i - 1]], ...points[path[i]])
    );
  }
} else {
  root.appendChild(App().element);
}
