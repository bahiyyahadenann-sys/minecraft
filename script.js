// Konfigurasi Asas Three.js
let scene, camera, renderer;
let blocks = [];
let blockMap = new Map(); // Untuk carian koordinat blok pantas (key: x,y,z)

// Pilihan Blok Semasa
let selectedBlockType = 'GRASS';

// Jenis-jenis Blok dan Warnanya
const BLOCK_TYPES = {
    GRASS: { name: 'Rumput', topColor: 0x55aa44, sideColor: 0x795548, bottomColor: 0x795548 },
    DIRT: { name: 'Tanah', topColor: 0x795548, sideColor: 0x795548, bottomColor: 0x795548 },
    STONE: { name: 'Batu', topColor: 0x808080, sideColor: 0x808080, bottomColor: 0x808080 },
    WOOD: { name: 'Kayu', topColor: 0x8d6e63, sideColor: 0x5d4037, bottomColor: 0x8d6e63 },
    LEAVES: { name: 'Daun', topColor: 0x2e7d32, sideColor: 0x2e7d32, bottomColor: 0x2e7d32 },
    SAND: { name: 'Pasir', topColor: 0xe0c686, sideColor: 0xe0c686, bottomColor: 0xe0c686 }
};

// Fizik & Kawalan Pergerakan Player
const moveState = { forward: false, backward: false, left: false, right: false, jump: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;

// Orientasi Kamera FPS
let pitch = 0; // Atas/Bawah
let yaw = 0;   // Kiri/Kanan

// Raycaster untuk Mengesan Blok (Bina/Musnah)
const raycaster = new THREE.Raycaster();
const centerVector = new THREE.Vector2(0, 0);

// Elemen DOM
const instructionsOverlay = document.getElementById('instructions-overlay');
const startBtn = document.getElementById('start-btn');
const canvas = document.getElementById('webgl-canvas');

// Inisialisasi Apabila Tetingkap Di-load
window.onload = function() {
    initScene();
    generateTerrain();
    setupEvents();
    animate();
};

function initScene() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Warna Langit Biru
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.025);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Pencahayaan (Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    const d = 40;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);
}

// Cipta Blok Voxel Single Mesh Optimization
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

function createBlockMaterial(typeKey) {
    const info = BLOCK_TYPES[typeKey];
    
    // 6 Muka Blok: [Right, Left, Top, Bottom, Front, Back]
    const topMat = new THREE.MeshLambertMaterial({ color: info.topColor });
    const sideMat = new THREE.MeshLambertMaterial({ color: info.sideColor });
    const bottomMat = new THREE.MeshLambertMaterial({ color: info.bottomColor });

    return [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
}

function addBlock(x, y, z, typeKey) {
    const key = `${x},${y},${z}`;
    if (blockMap.has(key)) return;

    const materials = createBlockMaterial(typeKey);
    const mesh = new THREE.Mesh(cubeGeometry, materials);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: typeKey, x: x, y: y, z: z };

    scene.add(mesh);
    blocks.push(mesh);
    blockMap.set(key, mesh);
}

function removeBlock(mesh) {
    if (!mesh) return;
    const key = `${mesh.userData.x},${mesh.userData.y},${mesh.userData.z}`;
    
    scene.remove(mesh);
    blockMap.delete(key);
    
    const index = blocks.indexOf(mesh);
    if (index > -1) {
        blocks.splice(index, 1);
    }
    
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
    } else {
        mesh.material.dispose();
    }
}

function generateTerrain() {
    const chunkSize = 16;
    
    for (let x = -chunkSize; x <= chunkSize; x++) {
        for (let z = -chunkSize; z <= chunkSize; z++) {
            // Formula Tinggi Bukit Ringkas (Sinusoidal Terrain)
            const height = Math.floor(Math.sin(x * 0.2) * Math.cos(z * 0.2) * 2.5) + 2;

            // Lapisan Bawah (Batu)
            for (let y = 0; y < height - 1; y++) {
                addBlock(x, y, z, y === 0 ? 'STONE' : 'DIRT');
            }

            // Lapisan Atas (Rumput)
            addBlock(x, height - 1, z, 'GRASS');

            // Hasilkan Pokok Rawak
            if (x % 5 === 0 && z % 5 === 0 && Math.random() > 0.6) {
                generateTree(x, height, z);
            }
        }
    }
}

function generateTree(x, startY, z) {
    const trunkHeight = 4;
    // Batang Pokok
    for (let i = 0; i < trunkHeight; i++) {
        addBlock(x, startY + i, z, 'WOOD');
    }
    // Daun Pokok
    const leafStartY = startY + trunkHeight - 1;
    for (let lx = -1; lx <= 1; lx++) {
        for (let lz = -1; lz <= 1; lz++) {
            for (let ly = 0; ly <= 2; ly++) {
                if (lx === 0 && lz === 0 && ly < 2) continue;
                addBlock(x + lx, leafStartY + ly, z + lz, 'LEAVES');
            }
        }
    }
}

function setupEvents() {
    // Kunci Tetikus (Pointer Lock)
    startBtn.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
            instructionsOverlay.style.display = 'none';
        } else {
            instructionsOverlay.style.display = 'flex';
        }
    });

    // Pergerakan Tetikus (FPS Camera Look)
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== canvas) return;

        const sensitivity = 0.002;
        yaw -= e.movementX * sensitivity;
        pitch -= e.movementY * sensitivity;

        // Hadkan pandangan atas/bawah
        pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));

        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    });

    // Papan Kekunci
    document.addEventListener('keydown', (e) => onKeyChange(e, true));
    document.addEventListener('keyup', (e) => onKeyChange(e, false));

    // Klik Tetikus (Musnah / Bina)
    document.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement !== canvas) return;

        raycaster.setFromCamera(centerVector, camera);
        const intersects = raycaster.intersectObjects(blocks);

        if (intersects.length > 0 && intersects[0].distance < 8) {
            const hit = intersects[0];

            if (e.button === 0) {
                // Klik Kiri: Musnahkan Blok
                removeBlock(hit.object);
            } else if (e.button === 2) {
                // Klik Kanan: Bina Blok pada Muka Bersebelahan
                const normal = hit.face.normal;
                const targetX = hit.object.position.x + Math.round(normal.x);
                const targetY = hit.object.position.y + Math.round(normal.y);
                const targetZ = hit.object.position.z + Math.round(normal.z);

                // Halang pemain bina di dalam posisi diri sendiri
                const playerPos = camera.position;
                const distanceToPlayer = Math.hypot(targetX - playerPos.x, targetY - (playerPos.y - 1), targetZ - playerPos.z);
                
                if (distanceToPlayer > 0.8) {
                    addBlock(targetX, targetY, targetZ, selectedBlockType);
                }
            }
        }
    });

    // Halang Menu Klik Kanan Pelayar
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Pilih Slot Hotbar
    document.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            selectSlot(slot);
        });
    });

    // Roda Tetikus untuk Tukar Blok
    document.addEventListener('wheel', (e) => {
        const slots = document.querySelectorAll('.hotbar-slot');
        let activeIdx = Array.from(slots).findIndex(s => s.classList.contains('active'));
        
        if (e.deltaY > 0) {
            activeIdx = (activeIdx + 1) % slots.length;
        } else {
            activeIdx = (activeIdx - 1 + slots.length) % slots.length;
        }
        selectSlot(slots[activeIdx]);
    });

    // Resizing Window
    window.addEventListener('resize', onWindowResize);
}

function selectSlot(slotElement) {
    document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
    slotElement.classList.add('active');
    selectedBlockType = slotElement.getAttribute('data-block');
}

function onKeyChange(e, isDown) {
    switch (e.code) {
        case 'KeyW': moveState.forward = isDown; break;
        case 'KeyS': moveState.backward = isDown; break;
        case 'KeyA': moveState.left = isDown; break;
        case 'KeyD': moveState.right = isDown; break;
        case 'Space': moveState.jump = isDown; break;
        
        // Pilihan Angka 1-6
        case 'Digit1': selectSlotByIndex(0); break;
        case 'Digit2': selectSlotByIndex(1); break;
        case 'Digit3': selectSlotByIndex(2); break;
        case 'Digit4': selectSlotByIndex(3); break;
        case 'Digit5': selectSlotByIndex(4); break;
        case 'Digit6': selectSlotByIndex(5); break;
    }
}

function selectSlotByIndex(index) {
    const slots = document.querySelectorAll('.hotbar-slot');
    if (slots[index]) selectSlot(slots[index]);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    if (document.pointerLockElement === canvas) {
        updatePhysics(delta);
    }

    renderer.render(scene, camera);
}

function updatePhysics(delta) {
    // Pilihan Kelajuan
    const speed = 12.0;
    const gravity = 28.0;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= gravity * delta; // Graviti

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    // Vektor Gerakan Berdasarkan Arah Pandangan Kamera
    const cameraYaw = camera.rotation.y;
    
    if (moveState.forward || moveState.backward) {
        velocity.z -= (Math.cos(cameraYaw) * direction.z - Math.sin(cameraYaw) * direction.x) * speed * delta * 10;
        velocity.x -= (Math.sin(cameraYaw) * direction.z + Math.cos(cameraYaw) * direction.x) * speed * delta * 10;
    }
    if (moveState.left || moveState.right) {
        velocity.z -= (Math.cos(cameraYaw) * direction.z - Math.sin(cameraYaw) * direction.x) * speed * delta * 10;
        velocity.x -= (Math.sin(cameraYaw) * direction.z + Math.cos(cameraYaw) * direction.x) * speed * delta * 10;
    }

    // Lompatan
    if (moveState.jump && canJump) {
        velocity.y = 10.0;
        canJump = false;
    }

    // Kemaskini Kedudukan
    camera.position.x += velocity.x * delta;
    camera.position.z += velocity.z * delta;
    camera.position.y += velocity.y * delta;

    // Pelanggaran Lantai Asas (Collision dengan permukaan tanah)
    const playerX = Math.round(camera.position.x);
    const playerZ = Math.round(camera.position.z);
    
    // Cari blok tertinggi pada koordinat pemain
    let groundY = 0;
    for (let y = 15; y >= 0; y--) {
        if (blockMap.has(`${playerX},${y},${playerZ}`)) {
            groundY = y + 1.6; // Ketinggian mata watak
            break;
        }
    }

    if (camera.position.y < groundY) {
        velocity.y = 0;
        camera.position.y = groundY;
        canJump = true;
    }
}