
import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as OBC from "@thatopen/components";

const container = document.getElementById("container")!;

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();

world.camera.controls.setLookAt(12, 6, 8, 0, 0, -10);

world.scene.setup();

const grids = components.get(OBC.Grids);
grids.create(world);

world.scene.three.background = null;


/* MD
  ### 🚗🏎️ Getting IFC and fragments
  ---
  When we read an IFC file, we convert it to a geometry called Fragments. Fragments are a lightweight representation of geometry built on top of THREE.js `InstancedMesh` to make it easy to work with BIM data efficiently. All the BIM geometry you see in our libraries are Fragments, and they are great: they are lightweight, they are fast and we have tons of tools to work with them. But fragments are not used outside our libraries. So how can we convert an IFC file to fragments? Let's check out how:
  */

const fragments = components.get(OBC.FragmentsManager);
const fragmentIfcLoader = components.get(OBC.IfcLoader);

/* MD
  :::info Why not just IFC?

  IFC is nice because it lets us exchange data with many tools in the AECO industry. But your graphics card doesn't understand IFC. It only understands one thing: triangles. So we must convert IFC to triangles. There are many ways to do it, some more efficient than others. And that's exactly what Fragments are: a very efficient way to display the triangles coming from IFC files. 
  :::
  Once Fragments have been generated, you can export them and then load them back directly, without needing the original IFC file. Why would you do that? Well, because fragments can load +10 times faster than IFC. And the reason is very simple.   When reading an IFC, we must parse the file, read the implicit geometry, convert it to triangles (Fragments) and send it to the GPU. When reading fragments, we just take the triangles and send them, so it's super fast. 
  :::danger How to use Fragments?
  If you want to find out more about Fragments, check out the Fragments Manager tutorial.
  :::
  ### 🔭🔧 Calibrating the converter
  ---
  Now, we need to configure the path of the WASM files. What's WASM? It's a technology that lets us run C++ on the browser, which means that we can load IFCs super fast! These files are the compilation of our `web-ifc` library. You can find them in the github repo and in NPM. These files need to be available to our app, so you have 2 options:
  - Download them and serve them statically.
  - Get them from a remote server.

  The easiest way is getting them from unpkg, and the cool thing is that you don't need to do it manually! It can be done directly by the tool just by writing the following:
  */

// await fragmentIfcLoader.setup();

async function setupLoader() {
  await fragmentIfcLoader.setup();
}

setupLoader();

// If you want to the path to unpkg manually, then you can skip the line
// above and set them manually as below:
// fragmentIfcLoader.settings.wasm = {
//     path: "https://unpkg.com/web-ifc@0.0.53/",
//     absolute: true
// }

/* MD
  Awesome! Optionally, we can exclude categories that we don't want to convert to fragments like very easily:
*/

const excludedCats = [
  WEBIFC.IFCTENDONANCHOR,
  WEBIFC.IFCREINFORCINGBAR,
  WEBIFC.IFCREINFORCINGELEMENT,
];

for (const cat of excludedCats) {
  fragmentIfcLoader.settings.excludedCategories.add(cat);
}

/* MD
  We can further configure the conversion using the `webIfc` object. In this example, we will make the IFC model go to the origin of the scene (don't worry, this supports model federation):
  */

fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

/* MD
  ### 🚗🔥 Loading the IFC
  ---
  Next, let's define a function to load the IFC programmatically. We have hardcoded the path to one of our IFC files, but feel free to do this with any of your own files!

 :::info Opening local IFCs

  Keep in mind that the browser can't access the file of your computer directly, so you will need to use the Open File API to open local files.

  :::
*/

// async function loadIfc() {
//   const file = await fetch("https://thatopen.github.io/engine_components/resources/small.ifc");
//   const data = await file.arrayBuffer();
//   const buffer = new Uint8Array(data);
//   const model = await fragmentIfcLoader.load(buffer);
//   // model.name = "example";
//   world.scene.three.add(model);
// }
//-----
// Получаем элемент input
const input = document.getElementById('ifcInput');

if (input) {
  input.addEventListener('change', async (event) => {
    const inputElement = event.target as HTMLInputElement;
    
    if (inputElement.files && inputElement.files.length > 0) {
      const file = inputElement.files[0];
      
      // Получаем ArrayBuffer из файла
      const data = await file.arrayBuffer();
      // Создаем Uint8Array из ArrayBuffer
      const buffer = new Uint8Array(data);
      
      // Проверяем, что fragmentIfcLoader и world.scene.three существуют
      if (fragmentIfcLoader && world.scene.three) {
        // Загружаем IFC-модель из Uint8Array
        const fragmentsGroup = await fragmentIfcLoader.load(buffer);
        
           // Вычисляем габаритный объем модели
        const boundingBox = new THREE.Box3().setFromObject(fragmentsGroup);
        const modelMinY = boundingBox.min.y;

        // Перемещаем все объекты внутри items
        fragmentsGroup.items.forEach(fragment => {
          const mesh = fragment.mesh as THREE.Object3D;
          if (mesh instanceof THREE.InstancedMesh) {
            const matrix = new THREE.Matrix4();
            for (let i = 0; i < mesh.count; i++) {
              mesh.getMatrixAt(i, matrix);
              matrix.setPosition(matrix.elements[12], matrix.elements[13] - modelMinY, matrix.elements[14]);
              mesh.setMatrixAt(i, matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
          } else if (mesh instanceof THREE.Mesh) {
            (mesh as THREE.Mesh).position.y -= modelMinY; // Перемещаем каждый фрагмент вниз
          }
        });
        // Добавляем загруженную модель в сцену
        world.scene.three.add(fragmentsGroup);
      }
    }
  }, false);
} else {
  console.error("Element #ifcInput not found");
}

/* MD
  ### 🎁 Exporting the result to fragments
  ---
  Once you have your precious fragments, you might want to save them so that you don't need to open this IFC file each time your user gets into your app. Instead, the next time you can load the fragments directly. Defining a function to export fragments is as easy as this:
*/

function download(file: File) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function exportFragments() {
  if (!fragments.groups.size) {
    return;
  }
  const group = Array.from(fragments.groups.values())[0];
  const data = fragments.export(group);
  download(new File([new Blob([data])], "small.frag"));

  const properties = group.getLocalProperties();
  if (properties) {
    download(new File([JSON.stringify(properties)], "small.json"));
  }
}

function disposeFragments() {
  fragments.dispose();
    // Сброс input после удаления фрагмента
    const inputElement = document.getElementById('ifcInput') as HTMLInputElement | null;
    if (inputElement) {
      inputElement.value = '';
    }
  
}

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

BUI.Manager.init();

const panel = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
  <bim-panel active label="IFC Loader Tutorial" class="options-menu">
    <bim-panel-section collapsed label="Controls">
      <bim-panel-section style="padding-top: 12px;">
      
        <bim-button label="Load IFC"
  @click="${() => {
    const inputElement = document.getElementById('ifcInput');
    if (inputElement) {
      inputElement.click(); // Открываем диалог выбора файла только если элемент существует
    } else {
      console.error("Element #ifcInput not found");
    }
  }}">
</bim-button>
            
        <bim-button label="Export fragments"
          @click="${() => {
            exportFragments();
          }}">
        </bim-button>  
            
        <bim-button label="Dispose fragments"
          @click="${() => {
            disposeFragments();
          }}">
        </bim-button>
      
      </bim-panel-section>
      
    </bim-panel>
  `;
});

document.body.append(panel);

const button = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
      <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
        @click="${() => {
          if (panel.classList.contains("options-menu-visible")) {
            panel.classList.remove("options-menu-visible");
          } else {
            panel.classList.add("options-menu-visible");
          }
        }}">
      </bim-button>
    `;
});

document.body.append(button);
