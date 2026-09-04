import * as THREE from 'three';

export interface DemoResult {
  group: THREE.Group;
  clips: THREE.AnimationClip[];
}

// A procedural humanoid with a Walk + Idle clip, so the tool is
// demoable before the user uploads their own GLB/GLTF.
export function buildDemoModel(): DemoResult {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a9aa8, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4350, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b28a, roughness: 0.5 });

  // torso + head
  const torso = new THREE.Group();
  torso.position.y = 1.2;
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), mat);
  torso.add(torsoMesh);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), skin);
  head.position.y = 0.62;
  torso.add(head);

  // arms pivot at shoulder
  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  const armL = new THREE.Group();
  armL.position.set(-0.42, 0.38, 0);
  const armLM = new THREE.Mesh(armGeo, mat);
  armLM.position.y = -0.35;
  armL.add(armLM);
  const armR = new THREE.Group();
  armR.position.set(0.42, 0.38, 0);
  const armRM = new THREE.Mesh(armGeo, mat);
  armRM.position.y = -0.35;
  armR.add(armRM);
  torso.add(armL);
  torso.add(armR);

  // legs pivot at hip
  const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.22);
  const legL = new THREE.Group();
  legL.position.set(-0.18, -0.4, 0);
  const legLM = new THREE.Mesh(legGeo, dark);
  legLM.position.y = -0.4;
  legL.add(legLM);
  const legR = new THREE.Group();
  legR.position.set(0.18, -0.4, 0);
  const legRM = new THREE.Mesh(legGeo, dark);
  legRM.position.y = -0.4;
  legR.add(legRM);
  torso.add(legL);
  torso.add(legR);

  // feet
  const footGeo = new THREE.BoxGeometry(0.24, 0.1, 0.42);
  const footL = new THREE.Mesh(footGeo, dark);
  footL.position.set(-0.18, -0.8, 0.08);
  const footR = new THREE.Mesh(footGeo, dark);
  footR.position.set(0.18, -0.8, 0.08);
  root.add(torso, footL, footR);

  // nose so front (+Z) is visually identifiable
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), dark);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.62, 0.28);
  root.add(nose);

  const t1 = new THREE.NumberKeyframeTrack('torso.position[y]', [0, 0.5, 1], [1.2, 1.1, 1.2]);
  const armLt = new THREE.NumberKeyframeTrack('armL.rotation[x]', [0, 0.5, 1], [0.6, -0.6, 0.6]);
  const armRt = new THREE.NumberKeyframeTrack('armR.rotation[x]', [0, 0.5, 1], [-0.6, 0.6, -0.6]);
  const legLt = new THREE.NumberKeyframeTrack('legL.rotation[x]', [0, 0.5, 1], [-0.5, 0.5, -0.5]);
  const legRt = new THREE.NumberKeyframeTrack('legR.rotation[x]', [0, 0.5, 1], [0.5, -0.5, 0.5]);
  const walk = new THREE.AnimationClip('Walk', 1.0, [t1, armLt, armRt, legLt, legRt]);

  const t1i = new THREE.NumberKeyframeTrack('torso.position[y]', [0, 0.5, 1], [1.2, 1.23, 1.2]);
  const armLtI = new THREE.NumberKeyframeTrack('armL.rotation[x]', [0, 0.5, 1], [0.04, 0.1, 0.04]);
  const armRtI = new THREE.NumberKeyframeTrack('armR.rotation[x]', [0, 0.5, 1], [-0.04, -0.1, -0.04]);
  const idle = new THREE.AnimationClip('Idle', 1.2, [t1i, armLtI, armRtI]);

  return { group: root, clips: [walk, idle] };
}
