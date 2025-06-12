import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// === Room ===
const roomSize = 20;
const textureLoader = new THREE.TextureLoader();
const gradientTexture = textureLoader.load('wall.png');

const materials = [
    new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.BackSide }),
    new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.BackSide }),
    new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.BackSide }),
    new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.BackSide }),
    new THREE.MeshStandardMaterial({ map: gradientTexture, side: THREE.BackSide }), // back wall
    new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.BackSide }),
];

const room = new THREE.Mesh(new THREE.BoxGeometry(roomSize, roomSize, roomSize), materials);
scene.add(room);

// === Lighting ===
scene.add(new THREE.AmbientLight(0x222233, 0.3));

const warmKey = new THREE.DirectionalLight(0xffd580, 1.3);
warmKey.position.set(-7, 5, 7);
warmKey.castShadow = true;
scene.add(warmKey);

const rimLights = [
    new THREE.SpotLight(0xffffff, 10, 100, Math.PI / 7, 0.3, 1),
    new THREE.SpotLight(0xffffff, 10, 100, Math.PI / 7, 0.3, 1),
    new THREE.SpotLight(0xffffff, 10, 100, Math.PI / 7, 0.3, 1),
    new THREE.SpotLight(0xffffff, 8, 100, Math.PI / 6, 0.3, 1),
];
rimLights[0].position.set(-5, 10, 0);
rimLights[1].position.set(0, 10, 5);
rimLights[2].position.set(5, 10, -5);
rimLights[3].position.set(0, 10, 0);
rimLights.forEach(rim => {
    rim.castShadow = true;
    rim.target.position.set(0, 0, 0);
    scene.add(rim);
    scene.add(rim.target);
});

const backLight = new THREE.PointLight(0x4488ff, 1.2, 40);
backLight.position.set(0, 0, -10);
scene.add(backLight);

scene.fog = new THREE.FogExp2(0x0f0f1a, 0.015);

// === Load Model ===
const gltfLoader = new GLTFLoader();
let mixer = null;
gltfLoader.load('models/myModel.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0, -roomSize * 0.25, 0);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const fitScale = (roomSize * 0.6) / Math.max(size.x, size.y, size.z);
    model.scale.set(fitScale, fitScale, fitScale);
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material.metalness = 0.2;
            child.material.roughness = 0.7;
        }
    });
    scene.add(model);
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
}, undefined, (err) => console.error('Model load error', err));

// === TEXT SETUP ===
let font;
let text = "Techno";
const ttfLoader = new TTFLoader();
const textGroup = new THREE.Group();
scene.add(textGroup);

const textOptions = {
    size: 3.5,
    depth: 0.6,
    curveSegments: 6,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelEnabled: true,
};

const mainTextMaterial = new THREE.MeshBasicMaterial({
    color: 0x2fa7e7,
    transparent: true,
    opacity: 1.0
});

const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0xff69b4, // Pink border
    side: THREE.BackSide
});

ttfLoader.load('fonts/Mechline.otf', (json) => {
    font = new Font(json);
    createTextMesh();
});

function createTextMesh() {
    if (!font) return;
    textGroup.clear();

    let offsetX = -9;
    const spacing = 0.6;
    const scale = 1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const geom = new TextGeometry(char, { font, ...textOptions });
        geom.computeBoundingBox();
        const width = geom.boundingBox.max.x - geom.boundingBox.min.x;

        const charMesh = new THREE.Mesh(geom, mainTextMaterial);
        const outlineMesh = new THREE.Mesh(geom.clone(), outlineMaterial);
        outlineMesh.scale.multiplyScalar(1.04);

        charMesh.position.set(roomSize / 2 - 0.2, -1, offsetX);
        outlineMesh.position.copy(charMesh.position);
        charMesh.rotation.y = outlineMesh.rotation.y = -Math.PI / 2;

        textGroup.add(outlineMesh);
        textGroup.add(charMesh);

        offsetX += width * scale + spacing;
    }
}

document.addEventListener('keypress', (e) => {
    text += e.key;
    createTextMesh();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        text = text.slice(0, -1);
        createTextMesh();
        e.preventDefault();
    }
});

// === MAGIC FLOATING CRYSTALS ===
const crystalGroup = new THREE.Group();
scene.add(crystalGroup);

const createCrystal = (color, size) => {
    const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.3,
        metalness: 0.6,
        emissive: color,
        emissiveIntensity: 1.5,
        transmission: 0.4,
        thickness: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.2,
    });
    const geo = new THREE.OctahedronGeometry(size, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
};

const crystalColors = [0x87ceeb, 0xffd700, 0x8a2be2, 0x00ff7f, 0xff4500, 0x1e90ff];
for (let i = 0; i < 20; i++) {
    const color = crystalColors[i % 2];
    const crystal = createCrystal(color, 0.25 + Math.random() * 0.1);
    crystal.position.set(
        (Math.random() - 0.5) * roomSize,
        (Math.random() - 0.5) * roomSize,
        (Math.random() - 0.5) * roomSize
    );
    crystal.userData = {
        floatSpeed: 0.5 + Math.random(),
        baseY: crystal.position.y,
        rotSpeed: Math.random() * 0.02
    };
    crystalGroup.add(crystal);
}

// === Animate ===
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    if (mixer) mixer.update(delta);
    controls.update();

    const flicker = 0.7 + 0.3 * Math.sin(elapsed * 10) * Math.abs(Math.sin(elapsed * 3));
    mainTextMaterial.opacity = flicker;

    crystalGroup.children.forEach(crystal => {
        const { floatSpeed, baseY, rotSpeed } = crystal.userData;
        crystal.position.y = baseY + Math.sin(elapsed * floatSpeed) * 0.3;
        crystal.rotation.y += rotSpeed;
        crystal.rotation.x += rotSpeed * 0.5;
    });

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
