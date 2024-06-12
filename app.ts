
import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

const container = document.getElementById("container")!;
const fileNameDisplay = document.getElementById("file-name");
const buttonsContainer = document.getElementById("buttons-container");

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

const fragments = components.get(OBC.FragmentsManager);
const fragmentIfcLoader = components.get(OBC.IfcLoader);

// await fragmentIfcLoader.setup();

async function setupLoader() {
  await fragmentIfcLoader.setup({  wasm: {
    path: "./",
    absolute: true
  }});
}

setupLoader();

const excludedCats = [
  WEBIFC.IFCTENDONANCHOR,
  WEBIFC.IFCREINFORCINGBAR,
  WEBIFC.IFCREINFORCINGELEMENT,
];

for (const cat of excludedCats) {
  fragmentIfcLoader.settings.excludedCategories.add(cat);
}

fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

/* MD

  Keep in mind that the browser can't access the file of your computer directly, so you will need to use the Open File API to open local files.

  :::
*/

// async function loadIfc() {
//   const file = await fetch("./models/EJES-rEVIT.ifc");
//   const data = await file.arrayBuffer();
//   const buffer = new Uint8Array(data);
//   const model = await fragmentIfcLoader.load(buffer);
//   // model.name = "example";
//   world.scene.three.add(model);
// }
let uuid = "";
async function loadIfc() {
  const file = await fetch("./models/EJES-rEVIT.ifc");
  const data = await file.arrayBuffer();
  const buffer = new Uint8Array(data);
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

  world.scene.three.add(fragmentsGroup);
  uuid = fragmentsGroup.uuid; // Сохраняем UUID загруженной группы
}
//-----
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

        world.scene.three.add(fragmentsGroup);
      }

      if (fileNameDisplay) {
        fileNameDisplay.textContent = `Loaded file: ${file.name}`;
      }
     
    }
  }, false);
} else {
  console.error("Element #ifcInput not found");
}

/* MD
  ### 🎁 Exporting the result to fragments
  ---
  Once you have your precious fragments, you might want to save them so that you don't need to open this IFC file each time your user gets into your app. Instead, the next time you can load the fragments directly. 
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

//----
// async function exportAllFragments() {
//   if (!fragments.groups.size) {
//     return;
//   }

//   fragments.groups.forEach((group, groupId) => {
//     const data = fragments.export(group);
//     download(new File([new Blob([data])], `${groupId}.frag`));

//     const properties = group.getLocalProperties();
//     if (properties) {
//       download(new File([JSON.stringify(properties)], `${groupId}.json`));
//     }
//   });
// }
//------------------
function disposeFragments() {
  fragments.dispose();
    // Сброс input после удаления фрагмента
    const inputElement = document.getElementById('ifcInput') as HTMLInputElement | null;
    if (inputElement) {
      inputElement.value = '';
    }
  
}

BUI.Manager.init();
// <bim-panel active label="IFC Loader " >
//</bim-panel>
const panel = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
 
    <bim-panel-section collapsed label="Controls">
      <bim-panel-section style="padding-top: 2px;">
      
        <bim-button label="Load IFC"
  @click="${() => {// loadOtherFile()
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
            // exportAllFragments()
          }}">
        </bim-button>  
            
        <bim-button label="Dispose fragments"
          @click="${() => {
            disposeFragments();
          }}">
        </bim-button>
      
      </bim-panel-section>
      
    
  `;
});

document.body.append(panel);
//-----------
// const inputFrag = document.getElementById('fragInput');
// if (inputFrag) {
//   inputFrag.addEventListener('change', async (event) => {
//     const inputElement = event.target as HTMLInputElement;
//     inputFrag.addEventListener('change', async (event) => {
//   const inputElement = event.target as HTMLInputElement;
  
//   if (inputElement.files && inputElement.files.length > 0) {
//     let fragFile, jsonFile;
//     for (const file of inputElement.files) {
//       if (file.name.endsWith('.frag')) {
//         fragFile = file;
//       } else if (file.name.endsWith('.json')) {
//         jsonFile = file;
//       }
//     }
    
//     if (fragFile && jsonFile) {
//       // Загрузите и обработайте файлы .frag и .json
//       await loadFragments(fragFile, jsonFile);
//     } else {
//       console.error("Both .frag and .json files are required");
//     }
//   }
// });
//   })
// }
// async function loadFrag(fragFile: { arrayBuffer: () => any; }, jsonFile: Blob) {
//   // Загрузите содержимое fragFile и jsonFile
//   // Пример загрузки содержимого файла .frag
//   const fragData = await fragFile.arrayBuffer();
//   const fragBuffer = new Uint8Array(fragData);
  
//   // Пример загрузки содержимого файла .json
//   const jsonData = await new Promise((resolve) => {
//     const reader = new FileReader();
//     reader.onload = (e) => resolve(JSON.parse(e.target.result));
//     reader.readAsText(jsonFile);
//   });
  
//   // Теперь у вас есть fragBuffer и jsonData, которые можно использовать для загрузки фрагментов
//   // Продолжите обработку данных здесь...
// }



//  const loadFragmentsButton = document.getElementById('loadFragmentsButton') as HTMLButtonElement | null;
//  if (loadFragmentsButton) {
//   loadFragmentsButton.addEventListener('click', () => {
//     inputFrag.click();
//   });
// }



// let uuid = "";

// async function loadFragments(fragFile?: File, jsonFile?: File) {
//   if (fragments.groups.size) {
//     return;
//   }
//   const fragFile = await fetch(
//     "https://thatopen.github.io/engine_components/resources/small.frag",
//   );
//   const fragData = await fragFile.arrayBuffer();
//   const fragBuffer = new Uint8Array(fragData);

//   const jsonFile = await fetch(
//     "https://thatopen.github.io/engine_components/resources/small.json",
//   );
//   const jsonData = await jsonFile.json();

//   const group = await fragments.load(fragBuffer);
//   group.setLocalProperties(jsonData); // Установите свойства, если метод доступен

//   world.scene.three.add(group);
//   uuid = group.uuid;
// }
// Получаем элемент input для загрузки .frag файлов
const inputFrag = document.getElementById('fragInput');

// Обработчик для кнопки, который вызывает клик по скрытому input
const loadFragmentsButton = document.getElementById('loadFragmentsButton');
if (loadFragmentsButton && inputFrag) {
  loadFragmentsButton.addEventListener('click', () => {
    inputFrag.click(); // Программно вызываем клик по скрытому input
  });
}

// Обработчик события изменения для input, который загружает выбранный .frag файл
if (inputFrag) {
  inputFrag.addEventListener('change', async (event) => {
    const inputElement = event.target as HTMLInputElement;
    
    if (inputElement.files && inputElement.files.length > 0) {
      const fragFile = inputElement.files[0];
      if (fragFile.name.endsWith('.frag')) {
        await loadFrag(fragFile);
      } else {
        console.error("A .frag file is required");
      }
    }
  });
}

// Функция для загрузки .frag файла и добавления его в сцену
async function loadFrag(fragFile: File) {
  const fragData = await fragFile.arrayBuffer();
  const fragBuffer = new Uint8Array(fragData);
  
  // Проверяем, что fragmentIfcLoader и world.scene.three существуют
  if (fragmentIfcLoader && world.scene.three) {
    // Загружаем .frag-модель из Uint8Array
    const fragmentsGroup = await fragmentIfcLoader.load(fragBuffer);
    
    // Добавляем загруженную модель в сцену
    world.scene.three.add(fragmentsGroup);
  }
}

 // Вызов функции loadIfc при загрузке страницы
 document.addEventListener('DOMContentLoaded', loadIfc);
