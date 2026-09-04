import * as THREE from "three";
import { ANTENNA } from "./constants";
import type { SimEngine } from "./engine";
import { floorTransform } from "./render";
import { steelRgb } from "./steel";
import type { Piece } from "./types";
import { woodRgb } from "./wood";

export interface PaneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SKY = 0x3d74b8;
const HORIZON = 0xc9d8ea;
function rgb(t: [number, number, number]): THREE.Color {
	return new THREE.Color(t[0] / 255, t[1] / 255, t[2] / 255);
}
function glowTexture(size: number, stops: [number, string][]): THREE.CanvasTexture {
	const c = document.createElement("canvas");
	c.width = size;
	c.height = size;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	for (const [t, color] of stops) g.addColorStop(t, color);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	const tex = new THREE.CanvasTexture(c);
	tex.needsUpdate = true;
	return tex;
}
function flameTexture(): THREE.CanvasTexture {
	const w = 64;
	const h = 128;
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.clearRect(0, 0, w, h);
	const g = ctx.createRadialGradient(w / 2, h * .78, 3, w / 2, h * .45, h * .55);
	g.addColorStop(0, "rgba(255,252,230,1)");
	g.addColorStop(.18, "rgba(255,210,90,0.95)");
	g.addColorStop(.42, "rgba(255,120,28,0.75)");
	g.addColorStop(.72, "rgba(226,70,18,0.28)");
	g.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(w / 2, h * .08);
	ctx.bezierCurveTo(w * .72, h * .28, w * .92, h * .55, w * .72, h * .92);
	ctx.bezierCurveTo(w * .58, h * 1.02, w * .42, h * 1.02, w * .28, h * .92);
	ctx.bezierCurveTo(w * .08, h * .55, w * .28, h * .28, w / 2, h * .08);
	ctx.fill();
	const tex = new THREE.CanvasTexture(c);
	tex.needsUpdate = true;
	return tex;
}
function makeSky(): THREE.Mesh {
	const geo = new THREE.SphereGeometry(1800, 24, 16);
	const colors = new Float32Array(geo.attributes.position.count * 3);
	const pos = geo.attributes.position;
	const zenith = new THREE.Color(0x1e4f96);
	const horizon = new THREE.Color(HORIZON);
	const nadir = new THREE.Color(0x4d6a3a);
	const c = new THREE.Color();
	for (let i = 0; i < pos.count; i++) {
		const y = pos.getY(i) / 1800;
		if (y > 0) c.copy(horizon).lerp(zenith, Math.pow(y, .7));
		else c.copy(horizon).lerp(nadir, Math.min(1, -y * 1.5));
		colors[i * 3] = c.r;
		colors[i * 3 + 1] = c.g;
		colors[i * 3 + 2] = c.b;
	}
	geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
		vertexColors: true,
		side: THREE.BackSide,
		fog: false,
		depthWrite: false
	}));
}

function shingleTexture(): THREE.CanvasTexture {
	const s = 256;
	const c = document.createElement("canvas");
	c.width = s;
	c.height = s;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.fillStyle = "#2a1810";
	ctx.fillRect(0, 0, s, s);
	const cols = 7;
	const rows = 14;
	const sw = s / cols;
	const sh = s / rows;
	for (let r = 0; r < rows; r++) {
		const off = (r % 2) * 0.5;
		for (let col = -1; col <= cols; col++) {
			const x = (col + off) * sw;
			const y = r * sh;
			const n = ((r * 17 + col * 11 + 3) % 7);
			const rr = 92 + n * 10;
			const gg = 48 + n * 6;
			const bb = 28 + n * 3;
			ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
			const inset = 1.5;
			ctx.beginPath();
			ctx.moveTo(x + inset, y + inset);
			ctx.lineTo(x + sw - inset, y + inset);
			ctx.lineTo(x + sw - inset, y + sh - 4);
			ctx.quadraticCurveTo(x + sw / 2, y + sh + 1, x + inset, y + sh - 4);
			ctx.closePath();
			ctx.fill();
			ctx.strokeStyle = "rgba(8,6,5,0.55)";
			ctx.stroke();
		}
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(4, 6);
	tex.needsUpdate = true;
	return tex;
}
function clapboardTexture(): THREE.CanvasTexture {
	const s = 128;
	const c = document.createElement("canvas");
	c.width = s;
	c.height = s;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.fillStyle = "#efe2c8";
	ctx.fillRect(0, 0, s, s);
	for (let y = 0; y < s; y += 8) {
		const n = (y / 8) % 3;
		ctx.fillStyle = n === 0 ? "#f4e8d0" : n === 1 ? "#e8d4b4" : "#eddcb8";
		ctx.fillRect(0, y + 1, s, 6);
		ctx.fillStyle = "rgba(92, 58, 28, 0.28)";
		ctx.fillRect(0, y + 7, s, 1);
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(3, 6);
	tex.needsUpdate = true;
	return tex;
}
function facadeTexture(door: boolean): THREE.CanvasTexture {
	const w = 256;
	const h = 256;
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.clearRect(0, 0, w, h);
	// Ghost clapboard — interior timber has to read through the wall.
	ctx.globalAlpha = 0.42;
	ctx.fillStyle = "#efe2c8";
	ctx.fillRect(0, 0, w, h);
	for (let y = 0; y < h; y += 10) {
		const n = (y / 10) % 3;
		ctx.fillStyle = n === 0 ? "#f4e8d0" : n === 1 ? "#e8d4b4" : "#eddcb8";
		ctx.fillRect(0, y + 1, w, 8);
		ctx.fillStyle = "rgba(92, 58, 28, 0.22)";
		ctx.fillRect(0, y + 9, w, 1);
	}
	const pane = (x: number, y: number, ww: number, hh: number) => {
		ctx.save();
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 0.92;
		ctx.fillStyle = "#3d7eb8";
		ctx.fillRect(x, y, ww, hh);
		ctx.globalAlpha = 0.35;
		ctx.fillStyle = "#c8e4f8";
		ctx.fillRect(x, y, ww * 0.45, hh);
		ctx.restore();
		ctx.globalAlpha = 0.9;
		ctx.strokeStyle = "#3a2f24";
		ctx.lineWidth = 5;
		ctx.strokeRect(x, y, ww, hh);
		ctx.globalAlpha = 0.85;
		ctx.strokeStyle = "#f6efe4";
		ctx.lineWidth = 2;
		ctx.strokeRect(x + 1, y + 1, ww - 2, hh - 2);
		ctx.beginPath();
		ctx.moveTo(x + ww / 2, y);
		ctx.lineTo(x + ww / 2, y + hh);
		ctx.moveTo(x, y + hh / 2);
		ctx.lineTo(x + ww, y + hh / 2);
		ctx.stroke();
	};
	if (door) {
		pane(28, 22, 72, 88);
		pane(156, 22, 72, 88);
		pane(168, 132, 64, 78);
		ctx.globalAlpha = 1;
		ctx.fillStyle = "#2f5a3c";
		ctx.fillRect(96, 132, 56, 118);
		ctx.strokeStyle = "#1a3322";
		ctx.lineWidth = 3;
		ctx.strokeRect(96, 132, 56, 118);
		ctx.strokeRect(102, 140, 44, 48);
		ctx.strokeRect(102, 196, 44, 46);
		ctx.fillStyle = "#d4a84a";
		ctx.beginPath();
		ctx.arc(142, 198, 4, 0, Math.PI * 2);
		ctx.fill();
	} else {
		pane(24, 22, 88, 96);
		pane(144, 22, 88, 96);
		pane(24, 140, 88, 92);
		pane(144, 140, 88, 92);
	}
	ctx.globalAlpha = 1;
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.premultiplyAlpha = false;
	tex.needsUpdate = true;
	return tex;
}
function apartmentTexture(door: boolean): THREE.CanvasTexture {
	const w = 256;
	const h = 128;
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.fillStyle = "#b58a62";
	ctx.fillRect(0, 0, w, h);
	for (let y = 8; y < h - 10; y += 7) {
		const off = (y / 7) % 2 === 0 ? 0 : 9;
		for (let x = -10; x < w; x += 18) {
			const n = ((x + y) / 7) % 4;
			ctx.fillStyle = n === 0 ? "#a87850" : n === 1 ? "#c4966c" : n === 2 ? "#b08058" : "#c9a078";
			ctx.fillRect(x + off, y, 16, 6);
			ctx.fillStyle = "rgba(62, 40, 24, 0.35)";
			ctx.fillRect(x + off, y + 5, 16, 1);
		}
	}
	ctx.fillStyle = "#d8cbb8";
	ctx.fillRect(0, 0, w, 8);
	ctx.fillRect(0, h - 10, w, 10);
	const pane = (x: number, y: number, ww: number, hh: number) => {
		ctx.fillStyle = "#1c3a52";
		ctx.fillRect(x - 3, y - 3, ww + 6, hh + 6);
		ctx.fillStyle = "#2a5f86";
		ctx.fillRect(x, y, ww, hh);
		ctx.fillStyle = "rgba(190, 220, 240, 0.38)";
		ctx.fillRect(x, y, ww * 0.4, hh);
		ctx.strokeStyle = "#efe6d6";
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, ww, hh);
		ctx.beginPath();
		ctx.moveTo(x + ww / 2, y);
		ctx.lineTo(x + ww / 2, y + hh);
		ctx.moveTo(x, y + hh / 2);
		ctx.lineTo(x + ww, y + hh / 2);
		ctx.stroke();
	};
	if (door) {
		pane(12, 16, 36, 52);
		pane(56, 16, 36, 52);
		pane(188, 16, 36, 52);
		ctx.fillStyle = "#3d4a58";
		ctx.fillRect(108, 22, 52, 96);
		ctx.strokeStyle = "#1e262e";
		ctx.lineWidth = 3;
		ctx.strokeRect(108, 22, 52, 96);
		ctx.fillStyle = "#2a3540";
		ctx.fillRect(114, 30, 18, 36);
		ctx.fillRect(136, 30, 18, 36);
		ctx.fillRect(114, 72, 18, 38);
		ctx.fillRect(136, 72, 18, 38);
		ctx.fillStyle = "#d4a84a";
		ctx.beginPath();
		ctx.arc(152, 82, 3, 0, Math.PI * 2);
		ctx.fill();
	} else {
		for (let i = 0; i < 5; i++) pane(10 + i * 50, 18, 36, 58);
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.needsUpdate = true;
	return tex;
}
function grassTexture(): THREE.CanvasTexture {
	const s = 256;
	const c = document.createElement("canvas");
	c.width = s;
	c.height = s;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.fillStyle = "#3d6a2e";
	ctx.fillRect(0, 0, s, s);
	for (let i = 0; i < 1800; i++) {
		const x = (i * 47) % s;
		const y = (i * 91) % s;
		const n = i % 5;
		ctx.fillStyle = n === 0 ? "#2f5424" : n === 1 ? "#4e7c36" : n === 2 ? "#5a8a3a" : "#356028";
		ctx.fillRect(x, y, 2, 5);
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(48, 48);
	tex.needsUpdate = true;
	return tex;
}
function brickTexture(): THREE.CanvasTexture {
	const s = 256;
	const c = document.createElement("canvas");
	c.width = s;
	c.height = s;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.fillStyle = "#cfc4b4";
	ctx.fillRect(0, 0, s, s);
	const bh = 18;
	const bw = 42;
	for (let r = 0; r < 16; r++) {
		const off = (r % 2) * (bw / 2);
		for (let col = -1; col < 8; col++) {
			const x = col * bw + off;
			const y = r * bh;
			const n = (r * 13 + col * 7) % 5;
			ctx.fillStyle = n === 0 ? "#b85a3a" : n === 1 ? "#c46842" : n === 2 ? "#a84e32" : n === 3 ? "#d0784c" : "#9a4630";
			ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
		}
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(3, 2);
	tex.needsUpdate = true;
	return tex;
}
function towerFacadeTexture(): THREE.CanvasTexture {
	const w = 128;
	const h = 64;
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d");
	if (!ctx) return new THREE.CanvasTexture(c);
	ctx.fillStyle = "#d8e2ec";
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = "#0a2c48";
	ctx.fillRect(0, 16, w, 34);
	const cols = 8;
	const cw = w / cols;
	for (let col = 0; col < cols; col++) {
		ctx.fillStyle = col % 2 === 0 ? "#123a5c" : "#0c2a48";
		ctx.fillRect(col * cw + 2, 18, cw - 4, 30);
		ctx.fillStyle = "rgba(150, 200, 230, 0.28)";
		ctx.fillRect(col * cw + 2, 18, (cw - 4) * 0.38, 30);
	}
	ctx.fillStyle = "#eef3f8";
	ctx.fillRect(0, 0, w, 6);
	ctx.fillRect(0, h - 6, w, 6);
	for (let col = 0; col <= cols; col++) {
		ctx.fillStyle = "#f2f6fa";
		ctx.fillRect(col * cw, 0, 2, h);
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(10, 1);
	tex.needsUpdate = true;
	return tex;
}
function extrudeDepth(p: Piece): number {
	return Math.max(p.depth, 0.06);
}
export class World3D {
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camFront: THREE.OrthographicCamera;
	camIso: THREE.PerspectiveCamera;
	camZoom: THREE.PerspectiveCamera;
	camTop: THREE.OrthographicCamera;
	ready = false;
	private floorMesh: THREE.InstancedMesh | null = null;
	private pieceGroup = new THREE.Group();
	private pieceMap = new Map<number, THREE.Object3D>();
	private firePoints: THREE.Points;
	private smokePoints: THREE.Points;
	private emberPoints: THREE.Points;
	private flames: THREE.Sprite[] = [];
	private planeMesh: THREE.Group;
	private cgrav: THREE.Line;
	private ghost: THREE.LineSegments | null = null;
	private plaza = new THREE.Group();
	private pitGroup = new THREE.Group();
	private antenna: THREE.Mesh;
	private fireLight: THREE.PointLight;
	private fireLight2: THREE.PointLight;
	private dummy = new THREE.Object3D();
	private builtKey = "";
	private logQuarterGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, 0.14, Math.PI / 2 - 0.28);
	private logGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
	private coneGeo = new THREE.ConeGeometry(0.5, 1, 10);
	private sphereGeo = new THREE.SphereGeometry(1, 8, 6);
	private boxGeo = new THREE.BoxGeometry(1, 1, 1);
	private woodMat = new THREE.MeshStandardMaterial({
		roughness: .86,
		metalness: .02
	});
	private steelMat = new THREE.MeshStandardMaterial({
		roughness: .55,
		metalness: .35
	});
	private fireGeo: THREE.BufferGeometry;
	private smokeGeo: THREE.BufferGeometry;
	private emberGeo: THREE.BufferGeometry;
	private firePos: Float32Array;
	private smokePos: Float32Array;
	private emberPos: Float32Array;
	private lastN = -1;
	private fireMap: THREE.CanvasTexture;
	private smokeMap: THREE.CanvasTexture;
	private flameMap: THREE.CanvasTexture;
	private shingleMap: THREE.CanvasTexture;
	private clapboardMap: THREE.CanvasTexture;
	private frontFacadeMap: THREE.CanvasTexture;
	private backFacadeMap: THREE.CanvasTexture;
	private aptFrontMap: THREE.CanvasTexture;
	private aptBackMap: THREE.CanvasTexture;
	private grassMap: THREE.CanvasTexture;
	private brickMap: THREE.CanvasTexture;
	private towerFacadeMap: THREE.CanvasTexture;
	private ground: THREE.Mesh;
	private roofMat: THREE.MeshStandardMaterial;
	private sidingMat: THREE.MeshStandardMaterial;
	private frontMat: THREE.MeshStandardMaterial;
	private backMat: THREE.MeshStandardMaterial;
	private aptFrontMat: THREE.MeshStandardMaterial;
	private aptBackMat: THREE.MeshStandardMaterial;
	private plasterMat: THREE.MeshStandardMaterial;
	private aptMode = false;
	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: "high-performance"
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.setClearColor(SKY, 1);
		this.renderer.autoClear = false;
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(SKY);
		this.scene.fog = new THREE.Fog(HORIZON, 40, 900);
		this.scene.add(makeSky());
		this.camFront = new THREE.OrthographicCamera(-10, 10, 10, -10, .2, 5e3);
		this.camIso = new THREE.PerspectiveCamera(34, 1, .2, 4e3);
		this.camZoom = new THREE.PerspectiveCamera(48, 1, .12, 2e3);
		this.camTop = new THREE.OrthographicCamera(-10, 10, 10, -10, .2, 2e3);
		this.scene.add(new THREE.HemisphereLight(0x9ec8f0, 0x4a6a38, 1.15));
		const sun = new THREE.DirectionalLight(0xfff1d0, 1.7);
		sun.position.set(-40, 80, 55);
		this.scene.add(sun);
		this.scene.add(new THREE.AmbientLight(0x8eb4d8, .28));
		this.fireLight = new THREE.PointLight(0xff4a12, 0, 18, 2);
		this.fireLight2 = new THREE.PointLight(0xffd070, 0, 10, 2);
		this.scene.add(this.fireLight);
		this.scene.add(this.fireLight2);
		this.grassMap = grassTexture();
		this.brickMap = brickTexture();
		this.towerFacadeMap = towerFacadeTexture();
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({
			map: this.grassMap,
			color: 0xffffff,
			roughness: .95,
			metalness: 0
		}));
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -.02;
		this.ground = ground;
		this.scene.add(ground);
		this.scene.add(this.plaza);
		this.scene.add(this.pitGroup);
		this.scene.add(this.pieceGroup);
		this.antenna = new THREE.Mesh(new THREE.CylinderGeometry(.35, .55, 1, 6), new THREE.MeshStandardMaterial({
			color: 0xb4bac4,
			roughness: .4,
			metalness: .6
		}));
		this.antenna.visible = false;
		this.scene.add(this.antenna);
		this.planeMesh = new THREE.Group();
		const fuselage = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({
			color: 0xf4f0ea,
			roughness: .4,
			metalness: .18
		}));
		fuselage.scale.set(48, 6, 6);
		this.planeMesh.add(fuselage);
		const stripe = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({
			color: 0x2a6a9a,
			roughness: .45,
			metalness: .2
		}));
		stripe.scale.set(48.2, 1.4, 6.2);
		stripe.position.y = -1.1;
		this.planeMesh.add(stripe);
		const wing = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({
			color: 0xd8e4ee,
			roughness: .5,
			metalness: .2
		}));
		wing.scale.set(14, 1.2, 44);
		this.planeMesh.add(wing);
		this.planeMesh.visible = false;
		this.scene.add(this.planeMesh);
		const cgGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
		this.cgrav = new THREE.Line(cgGeo, new THREE.LineBasicMaterial({ color: 0x3ecfc4 }));
		this.scene.add(this.cgrav);
		this.fireMap = glowTexture(64, [
			[0, "rgba(255,248,210,1)"],
			[.18, "rgba(255,170,50,0.95)"],
			[.5, "rgba(226,88,34,0.45)"],
			[1, "rgba(0,0,0,0)"]
		]);
		this.smokeMap = glowTexture(64, [
			[0, "rgba(90,90,96,0.55)"],
			[.45, "rgba(70,70,74,0.22)"],
			[1, "rgba(0,0,0,0)"]
		]);
		this.flameMap = flameTexture();
		this.shingleMap = shingleTexture();
		this.clapboardMap = clapboardTexture();
		this.frontFacadeMap = facadeTexture(true);
		this.backFacadeMap = facadeTexture(false);
		this.aptFrontMap = apartmentTexture(true);
		this.aptBackMap = apartmentTexture(false);
		this.roofMat = new THREE.MeshStandardMaterial({
			map: this.shingleMap,
			roughness: 0.92,
			metalness: 0,
			color: 0xffffff
		});
		this.sidingMat = new THREE.MeshStandardMaterial({
			map: this.clapboardMap,
			roughness: 0.88,
			metalness: 0,
			color: 0xf4e8d0
		});
		this.frontMat = new THREE.MeshStandardMaterial({
			map: this.frontFacadeMap,
			roughness: 0.88,
			metalness: 0,
			color: 0xffffff,
			transparent: true,
			opacity: 0.92,
			depthWrite: true,
			side: THREE.DoubleSide,
			alphaTest: 0.04,
		});
		this.backMat = new THREE.MeshStandardMaterial({
			map: this.backFacadeMap,
			roughness: 0.88,
			metalness: 0,
			color: 0xffffff,
			transparent: true,
			opacity: 0.92,
			depthWrite: true,
			side: THREE.DoubleSide,
			alphaTest: 0.04,
		});
		this.aptFrontMat = new THREE.MeshStandardMaterial({
			map: this.aptFrontMap,
			roughness: 0.82,
			metalness: 0,
			color: 0xffffff,
			transparent: false,
			opacity: 1,
			depthWrite: true,
			side: THREE.DoubleSide,
		});
		this.aptBackMat = new THREE.MeshStandardMaterial({
			map: this.aptBackMap,
			roughness: 0.82,
			metalness: 0,
			color: 0xffffff,
			transparent: false,
			opacity: 1,
			depthWrite: true,
			side: THREE.DoubleSide,
		});
		this.plasterMat = new THREE.MeshStandardMaterial({
			color: 0xe6dcc8,
			roughness: 0.92,
			metalness: 0,
		});
		this.firePos = new Float32Array(1800);
		this.smokePos = new Float32Array(1200);
		this.emberPos = new Float32Array(720);
		this.fireGeo = new THREE.BufferGeometry();
		this.fireGeo.setAttribute("position", new THREE.BufferAttribute(this.firePos, 3));
		this.smokeGeo = new THREE.BufferGeometry();
		this.smokeGeo.setAttribute("position", new THREE.BufferAttribute(this.smokePos, 3));
		this.emberGeo = new THREE.BufferGeometry();
		this.emberGeo.setAttribute("position", new THREE.BufferAttribute(this.emberPos, 3));
		this.firePoints = new THREE.Points(this.fireGeo, new THREE.PointsMaterial({
			map: this.fireMap,
			color: 0xff9a3a,
			size: .42,
			transparent: true,
			opacity: .92,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			sizeAttenuation: true
		}));
		this.smokePoints = new THREE.Points(this.smokeGeo, new THREE.PointsMaterial({
			map: this.smokeMap,
			color: 0x6a6a70,
			size: .9,
			transparent: true,
			opacity: .38,
			depthWrite: false,
			sizeAttenuation: true
		}));
		this.emberPoints = new THREE.Points(this.emberGeo, new THREE.PointsMaterial({
			map: this.fireMap,
			color: 0xffd080,
			size: .12,
			transparent: true,
			opacity: .95,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			sizeAttenuation: true
		}));
		this.scene.add(this.firePoints);
		this.scene.add(this.smokePoints);
		this.scene.add(this.emberPoints);
		const flameMat = new THREE.SpriteMaterial({
			map: this.flameMap,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			opacity: .9
		});
		for (let i = 0; i < 96; i++) {
			const spr = new THREE.Sprite(flameMat.clone());
			spr.visible = false;
			this.flames.push(spr);
			this.scene.add(spr);
		}
	}
	private cx(engine: SimEngine): number {
		return engine.width / 2;
	}
	rebuild(engine: SimEngine): void {
		const nFloors = engine.floors.length;
		const key = `${engine.scenario.id}-${engine.n}-${engine.width}-${engine.pieces.length}`;
		this.aptMode = engine.scenario.shape === "apartment";
		if (this.builtKey === key && this.lastN === nFloors) return;
		this.builtKey = key;
		this.lastN = nFloors;
		if (this.floorMesh) {
			this.scene.remove(this.floorMesh);
			this.floorMesh.dispose();
			this.floorMesh = null;
		}
		if (this.ghost) {
			this.scene.remove(this.ghost);
			this.ghost.geometry.dispose();
			this.ghost = null;
		}
		for (const m of this.pieceMap.values()) {
			this.pieceGroup.remove(m);
			for (const mat of this.pieceMats(m)) mat.dispose();
		}
		this.pieceMap.clear();
		this.plaza.clear();
		this.pitGroup.clear();
		const W = engine.width;
		const H = engine.height;
		const cx = this.cx(engine);
		if (engine.pit) this.buildPit(engine);
		else this.buildPlaza(engine, cx, W, H);
		if (nFloors > 0) {
			const geo = new THREE.BoxGeometry(W * .98, engine.floorH * .92, W * .98);
			const mat = new THREE.MeshStandardMaterial({
				map: this.towerFacadeMap,
				roughness: .48,
				metalness: .42,
				color: 0xffffff
			});
			this.floorMesh = new THREE.InstancedMesh(geo, mat, nFloors);
			this.floorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
			this.scene.add(this.floorMesh);
			const ghostGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, W));
			this.ghost = new THREE.LineSegments(ghostGeo, new THREE.LineDashedMaterial({
				color: 0xecebe6,
				dashSize: 4,
				gapSize: 3,
				transparent: true,
				opacity: .22
			}));
			this.ghost.position.set(cx, H / 2, 0);
			this.ghost.computeLineDistances();
			this.ghost.visible = false;
			this.scene.add(this.ghost);
		}
	}
	private buildPit(engine: SimEngine): void {
		const pit = engine.pit;
		if (!pit) return;
		this.ground.visible = false;
		const cx = (pit.left + pit.right) / 2;
		const pw = pit.right - pit.left;
		const pd = pit.far - pit.near;
		const floor = new THREE.Mesh(new THREE.BoxGeometry(pw, .08, pd), new THREE.MeshStandardMaterial({
			color: 0x2c2218,
			roughness: .96
		}));
		floor.position.set(cx, -pit.depth, 0);
		this.pitGroup.add(floor);
		const wallMat = new THREE.MeshStandardMaterial({
			map: this.brickMap,
			color: 0xffffff,
			roughness: .86
		});
		const specs: [number, number, number, number, number, number][] = [
			[cx, -pit.depth / 2, pit.near, pw + .12, pit.depth, .12],
			[cx, -pit.depth / 2, pit.far, pw + .12, pit.depth, .12],
			[pit.left, -pit.depth / 2, 0, .12, pit.depth, pd],
			[pit.right, -pit.depth / 2, 0, .12, pit.depth, pd]
		];
		for (const [x, y, z, w, h, d] of specs) {
			const m = new THREE.Mesh(this.boxGeo, wallMat);
			m.position.set(x, y, z);
			m.scale.set(w, h, d);
			this.pitGroup.add(m);
		}
		const rimMat = new THREE.MeshStandardMaterial({
			color: 0xd2c4a8,
			roughness: .82
		});
		const rimT = 0.28;
		const rimH = 0.1;
		const rims: [number, number, number, number, number, number][] = [
			[cx, rimH / 2, pit.near - rimT / 2, pw + rimT * 2, rimH, rimT],
			[cx, rimH / 2, pit.far + rimT / 2, pw + rimT * 2, rimH, rimT],
			[pit.left - rimT / 2, rimH / 2, 0, rimT, rimH, pd],
			[pit.right + rimT / 2, rimH / 2, 0, rimT, rimH, pd]
		];
		for (const [x, y, z, w, h, d] of rims) {
			const m = new THREE.Mesh(this.boxGeo, rimMat);
			m.position.set(x, y, z);
			m.scale.set(w, h, d);
			this.pitGroup.add(m);
		}
		const dirtMat = new THREE.MeshStandardMaterial({
			map: this.grassMap,
			color: 0xffffff,
			roughness: .95
		});
		const pad = 18;
		const dirtY = -0.02;
		const dirtH = 0.05;
		const dirt: [number, number, number, number, number, number][] = [
			[cx, dirtY, pit.near - pad / 2 - 0.2, pw + pad * 2, dirtH, pad],
			[cx, dirtY, pit.far + pad / 2 + 0.2, pw + pad * 2, dirtH, pad],
			[pit.left - pad / 2 - 0.2, dirtY, 0, pad, dirtH, pd],
			[pit.right + pad / 2 + 0.2, dirtY, 0, pad, dirtH, pd]
		];
		for (const [x, y, z, w, h, d] of dirt) {
			const m = new THREE.Mesh(this.boxGeo, dirtMat);
			m.position.set(x, y, z);
			m.scale.set(w, h, d);
			this.pitGroup.add(m);
		}
	}
	private buildPlaza(engine: SimEngine, cx: number, W: number, H: number): void {
		this.ground.visible = true;
		const lawn = engine.scenario.shape === "house" || engine.scenario.shape === "apartment";
		const gmat = this.ground.material as THREE.MeshStandardMaterial;
		gmat.map = this.grassMap;
		gmat.color.setHex(0xffffff);
		gmat.needsUpdate = true;
		if (lawn) {
			const pad = new THREE.Mesh(new THREE.BoxGeometry(W * 1.6, .08, W * 1.6), new THREE.MeshStandardMaterial({
				color: 0xc4b8a4,
				roughness: .88
			}));
			pad.position.set(cx, .02, 0);
			this.plaza.add(pad);
			return;
		}
		const plazaSize = Math.max(80, W * 6);
		const plaza = new THREE.Mesh(new THREE.BoxGeometry(plazaSize, .4, plazaSize), new THREE.MeshStandardMaterial({
			color: 0xc8bba8,
			roughness: .88
		}));
		plaza.position.set(cx, -.2, 0);
		this.plaza.add(plaza);
		const mark = new THREE.Mesh(new THREE.BoxGeometry(W * 1.04, .08, W * 1.04), new THREE.MeshStandardMaterial({
			color: 0x8ec4b8,
			roughness: .55,
			metalness: .15
		}));
		mark.position.set(cx, .05, 0);
		this.plaza.add(mark);
		const street = new THREE.MeshStandardMaterial({
			color: 0x3a3e44,
			roughness: .9
		});
		for (const z of [-W * 2.2, W * 2.2]) {
			const s = new THREE.Mesh(new THREE.BoxGeometry(plazaSize, .06, W * .55), street);
			s.position.set(cx, .03, z);
			this.plaza.add(s);
		}
		if (H > 40) {
			const brick = new THREE.MeshStandardMaterial({
				map: this.brickMap,
				color: 0xffffff,
				roughness: .82
			});
			const glass = new THREE.MeshStandardMaterial({
				color: 0x3a7a98,
				roughness: .28,
				metalness: .55
			});
			const limestone = new THREE.MeshStandardMaterial({
				color: 0xc8bca8,
				roughness: .78
			});
			const slate = new THREE.MeshStandardMaterial({
				color: 0x5a6878,
				roughness: .7
			});
			const neighbors: [number, number, number, number, number, number, THREE.Material][] = [
				[cx - W * 2.4, 8, -W * 2.8, W * .9, 16, W * .8, brick],
				[cx + W * 2.6, 6, -W * 2.5, W * .7, 12, W * .7, glass],
				[cx - W * 2.8, 5, W * 2.6, W * .8, 10, W * .9, limestone],
				[cx + W * 2.2, 7, W * 2.8, W * 1.1, 14, W * .6, slate],
			];
			for (const [x, y, z, w, h, d, mat] of neighbors) {
				const m = new THREE.Mesh(this.boxGeo, mat);
				m.position.set(x, y, z);
				m.scale.set(w, h, d);
				this.plaza.add(m);
			}
		}
	}
	private ensurePiece(p: Piece): THREE.Object3D {
		let m = this.pieceMap.get(p.id);
		if (m) return m;
		if (p.kind === "log") m = this.makeLog();
		else if (p.kind === "tree") m = this.makeTree();
		else if (p.kind === "couch") m = this.makeCouch();
		else {
			const isWall = p.kind === "wall";
			const facadeLong = isWall && p.w > p.depth * 2;
			const facadeSide = isWall && p.depth > p.w * 2 && (p.col === 0 || p.col === 4);
			const interior = isWall && !facadeLong && !facadeSide;
			const withDoor = facadeLong && p.z > 0.4 && (this.aptMode ? p.layer === 0 : p.layer < 5);
			const mat = (
				p.kind === "roof" ? this.roofMat :
				interior ? this.plasterMat :
				this.aptMode && withDoor ? this.aptFrontMat :
				this.aptMode && isWall ? this.aptBackMat :
				withDoor ? this.frontMat :
				isWall ? this.backMat :
				p.material === "wood" ? this.woodMat : this.steelMat
			).clone();
			if (isWall && !this.aptMode) {
				mat.transparent = true;
				mat.opacity = 0.88;
				mat.depthWrite = true;
				mat.side = THREE.DoubleSide;
				mat.alphaTest = 0.04;
				mat.roughness = 0.94;
			} else if (isWall && this.aptMode) {
				mat.transparent = false;
				mat.opacity = 1;
				mat.depthWrite = true;
				mat.side = THREE.DoubleSide;
				mat.roughness = interior ? 0.92 : 0.82;
			}
			m = new THREE.Mesh(this.boxGeo, mat);
		}
		this.pieceMap.set(p.id, m);
		this.pieceGroup.add(m);
		return m;
	}
	private makeLog(): THREE.Group {
		const g = new THREE.Group();
		for (let q = 0; q < 4; q++) {
			const mat = this.woodMat.clone();
			const mesh = new THREE.Mesh(this.logQuarterGeo, mat);
			const a = q * Math.PI / 2 + Math.PI / 4;
			mesh.rotation.y = q * Math.PI / 2;
			mesh.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
			g.add(mesh);
		}
		return g;
	}
	private makeTree(): THREE.Group {
		const g = new THREE.Group();
		const foliage = new THREE.Mesh(this.coneGeo, new THREE.MeshStandardMaterial({
			color: 0x1f6a32,
			roughness: 0.92,
			metalness: 0,
		}));
		foliage.position.y = 0.06;
		g.add(foliage);
		const trunk = new THREE.Mesh(this.logGeo, new THREE.MeshStandardMaterial({
			color: 0x5a3a22,
			roughness: 0.9,
			metalness: 0,
		}));
		trunk.position.y = -0.42;
		trunk.scale.set(0.16, 0.22, 0.16);
		g.add(trunk);
		const palette = [0xc41e3a, 0xd4a84a, 0xc41e3a, 0xe8eef4, 0xc41e3a, 0xd4a84a];
		for (let i = 0; i < 12; i++) {
			const t = 0.22 + (i % 6) * 0.11;
			const ang = i * 2.15 + 0.3;
			const rad = 0.38 * t;
			const ball = new THREE.Mesh(this.sphereGeo, new THREE.MeshStandardMaterial({
				color: palette[i % palette.length],
				roughness: 0.35,
				metalness: 0.25,
			}));
			ball.position.set(Math.cos(ang) * rad, 0.42 - t, Math.sin(ang) * rad);
			ball.scale.setScalar(0.055);
			g.add(ball);
		}
		const star = new THREE.Mesh(this.coneGeo, new THREE.MeshStandardMaterial({
			color: 0xf0d060,
			roughness: 0.4,
			emissive: 0xf0d060,
			emissiveIntensity: 0.35,
		}));
		star.position.y = 0.52;
		star.scale.set(0.14, 0.16, 0.14);
		g.add(star);
		return g;
	}
	private makeCouch(): THREE.Group {
		const g = new THREE.Group();
		const fabric = new THREE.MeshStandardMaterial({
			color: 0x6e2432,
			roughness: 0.88,
			metalness: 0,
		});
		const seat = new THREE.Mesh(this.boxGeo, fabric);
		seat.position.set(0, -0.18, 0);
		seat.scale.set(1, 0.36, 0.82);
		g.add(seat);
		const back = new THREE.Mesh(this.boxGeo, fabric.clone());
		back.position.set(0, 0.18, -0.34);
		back.scale.set(1, 0.72, 0.18);
		g.add(back);
		const armL = new THREE.Mesh(this.boxGeo, fabric.clone());
		armL.position.set(-0.46, 0.02, 0);
		armL.scale.set(0.12, 0.48, 0.82);
		g.add(armL);
		const armR = new THREE.Mesh(this.boxGeo, fabric.clone());
		armR.position.set(0.46, 0.02, 0);
		armR.scale.set(0.12, 0.48, 0.82);
		g.add(armR);
		return g;
	}
	private pieceMats(obj: THREE.Object3D): THREE.MeshStandardMaterial[] {
		const out: THREE.MeshStandardMaterial[] = [];
		obj.traverse((c) => {
			if (c instanceof THREE.Mesh) {
				const mat = c.material;
				if (Array.isArray(mat)) mat.forEach((x) => out.push(x as THREE.MeshStandardMaterial));
				else out.push(mat as THREE.MeshStandardMaterial);
			}
		});
		return out;
	}
	private syncPieces(engine: SimEngine): void {
		const seen = new Set<number>();
		for (const p of engine.pieces) {
			seen.add(p.id);
			const m = this.ensurePiece(p);
			const mats = this.pieceMats(m);
			const heat = Math.max(0, (p.temp - 280) / 800);
			const wood = p.material === "wood" ? woodRgb(p.temp, p.intact) : steelRgb(p.temp);
			for (let i = 0; i < mats.length; i++) {
				const mat = mats[i];
				if (p.kind === "roof" || p.kind === "wall") {
					const char = 1 - p.intact;
					mat.color.setRGB(1 - char * 0.55, 1 - char * 0.62, 1 - char * 0.68);
					if (p.kind === "wall" && !this.aptMode) {
						mat.transparent = true;
						mat.opacity = 0.88;
						mat.depthWrite = true;
						mat.side = THREE.DoubleSide;
						mat.alphaTest = 0.04;
					} else if (p.kind === "wall" && this.aptMode) {
						mat.transparent = false;
						mat.opacity = 1;
						mat.depthWrite = true;
						mat.side = THREE.DoubleSide;
					}
				} else if (p.kind === "joist" || p.kind === "sill" || p.kind === "plate") {
					mat.color.copy(rgb(wood));
					mat.emissive.setRGB(0, 0, 0);
					mat.emissiveIntensity = 0;
				} else if (p.kind === "tree") {
					const char = 1 - p.intact;
					if (i === 0) {
						mat.color.setRGB(
							0.12 * (1 - char) + wood[0] / 255 * char,
							0.42 * (1 - char) + wood[1] / 255 * char,
							0.18 * (1 - char) + wood[2] / 255 * char,
						);
					} else if (i === 1) {
						mat.color.copy(rgb(wood));
					}
					mat.emissive.setRGB(.32 * heat + .18 * p.burning, .1 * heat + .04 * p.burning, .02);
					mat.emissiveIntensity = p.burning * 0.55 + heat * .28;
				} else if (p.kind === "couch") {
					const char = 1 - p.intact;
					mat.color.setRGB(
						0.43 * (1 - char) + wood[0] / 255 * char,
						0.14 * (1 - char) + wood[1] / 255 * char,
						0.2 * (1 - char) + wood[2] / 255 * char,
					);
					mat.emissive.setRGB(.4 * heat + .2 * p.burning, .12 * heat + .05 * p.burning, .02);
					mat.emissiveIntensity = p.burning * 0.65 + heat * .3;
				} else if (p.kind === "log") {
					const tint = 0.92 + (i % 4) * 0.035;
					mat.color.setRGB(wood[0] / 255 * tint, wood[1] / 255 * tint, wood[2] / 255 * tint);
					mat.emissive.setRGB(.55 * heat + .35 * p.burning, .16 * heat + .08 * p.burning, .02);
					mat.emissiveIntensity = p.burning * 1.6 + heat * .7;
				} else {
					mat.color.copy(rgb(wood));
					const glow = p.kind === "stud" || p.kind === "column" || p.kind === "slab" ? 0.45 : 1;
					mat.emissive.setRGB((.55 * heat + .35 * p.burning) * glow, (.16 * heat + .08 * p.burning) * glow, .02);
					mat.emissiveIntensity = (p.burning * 1.2 + heat * .5) * glow;
				}
			}
			if (p.kind === "log") {
				const len = p.alongZ ? Math.max(p.w, p.depth) : p.w;
				const r = Math.max(0.012, p.h * 0.48);
				m.visible = p.h > 0.02;
				m.scale.set(r, Math.max(len, .06), r);
				m.position.set(p.x, p.y, p.z);
				if (p.alongZ) m.rotation.set(Math.PI / 2, 0, p.theta);
				else m.rotation.set(0, 0, Math.PI / 2 + p.theta);
			} else {
				const depth = extrudeDepth(p);
				m.scale.set(Math.max(p.w, .08), Math.max(p.h, .06), Math.max(depth, .08));
				m.position.set(p.x, p.y, p.z);
				m.rotation.set(0, 0, -p.theta);
				m.visible = true;
			}
		}
		for (const [id, m] of this.pieceMap) if (!seen.has(id)) m.visible = false;
	}
	private syncFloors(engine: SimEngine): void {
		const mesh = this.floorMesh;
		if (!mesh) return;
		const n = engine.floors.length;
		const H = engine.floorH;
		let crushedRank = 0;
		const color = new THREE.Color();
		if (!mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
		for (let i = 0; i < n; i++) {
			const f = engine.floors[i];
			const rank = f.state === "crushed" ? crushedRank : 0;
			if (f.state === "crushed") crushedRank += 1;
			const tf = floorTransform(engine, i, rank);
			this.dummy.position.set(tf.x, tf.y + tf.h * .5, 0);
			this.dummy.rotation.set(0, 0, -tf.theta);
			this.dummy.scale.set(1, Math.max(.12, tf.h / H), 1);
			this.dummy.updateMatrix();
			mesh.setMatrixAt(i, this.dummy.matrix);
			const burn = Math.max(...f.cols.map((c) => c.burning));
			const steel = steelRgb(Math.max(...f.cols.map((c) => c.temp)));
			if (f.state === "crushed") color.setRGB(.28, .27, .25);
			else if (burn > .15) color.setRGB(.85 + burn * .12, .28 + burn * .08, .08);
			else color.setRGB(steel[0] / 255, steel[1] / 255, steel[2] / 255);
			mesh.setColorAt(i, color);
		}
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		if (this.ghost) this.ghost.visible = engine.phase === "collapse" || engine.phase === "settled";
		const top = engine.floors[n - 1];
		if (engine.scenario.hasAntenna && top && top.state !== "crushed") {
			const tf = floorTransform(engine, n - 1, 0);
			this.antenna.visible = true;
			const cx0 = tf.x;
			const cy0 = tf.y + tf.h * 0.5;
			const upX = Math.sin(tf.theta);
			const upY = Math.cos(tf.theta);
			this.antenna.position.set(cx0 + upX * (tf.h * 0.5 + ANTENNA / 2), cy0 + upY * (tf.h * 0.5 + ANTENNA / 2), 0);
			this.antenna.scale.set(1, ANTENNA, 1);
			this.antenna.rotation.z = -tf.theta;
		} else this.antenna.visible = false;
	}
	private syncParticles(engine: SimEngine): void {
		let fi = 0;
		let si = 0;
		let ei = 0;
		let heatX = engine.width / 2;
		let heatY = 2;
		let heatZ = 0;
		let heatN = 0;
		const pieces = engine.isPieces;
		for (const p of engine.particles) if (p.kind === "fire") {
			if (fi >= 600) continue;
			this.firePos[fi * 3] = p.x;
			this.firePos[fi * 3 + 1] = p.y;
			this.firePos[fi * 3 + 2] = p.z;
			fi += 1;
			heatX += p.x;
			heatY += p.y;
			heatZ += p.z;
			heatN += 1;
		} else if (p.kind === "spark") {
			if (ei >= 240) continue;
			this.emberPos[ei * 3] = p.x;
			this.emberPos[ei * 3 + 1] = p.y;
			this.emberPos[ei * 3 + 2] = p.z;
			ei += 1;
		} else if (si < 400) {
			this.smokePos[si * 3] = p.x;
			this.smokePos[si * 3 + 1] = p.y;
			this.smokePos[si * 3 + 2] = p.z;
			si += 1;
		}
		for (const p of engine.pieces) {
			if (p.burning < .18 || fi >= 596) continue;
			if (p.kind === "wall" || p.kind === "roof" || p.kind === "joist" || p.kind === "sill" || p.kind === "plate") continue;
			const top = p.kind === "tree" || p.kind === "couch" ? p.h * 0.55 : Math.min(p.h * 0.45, 1.1);
			this.firePos[fi * 3] = p.x;
			this.firePos[fi * 3 + 1] = p.y + top * 0.4;
			this.firePos[fi * 3 + 2] = p.z;
			fi += 1;
			this.firePos[fi * 3] = p.x + .05;
			this.firePos[fi * 3 + 1] = p.y + top * 0.7;
			this.firePos[fi * 3 + 2] = p.z + .04;
			fi += 1;
			if (ei < 238) {
				this.emberPos[ei * 3] = p.x + p.id % 5 * .03;
				this.emberPos[ei * 3 + 1] = p.y + top * 0.85;
				this.emberPos[ei * 3 + 2] = p.z;
				ei += 1;
			}
			heatX += p.x;
			heatY += p.y;
			heatZ += p.z;
			heatN += 1;
		}
		this.fireGeo.getAttribute("position").needsUpdate = true;
		this.smokeGeo.getAttribute("position").needsUpdate = true;
		this.emberGeo.getAttribute("position").needsUpdate = true;
		this.fireGeo.setDrawRange(0, fi);
		this.smokeGeo.setDrawRange(0, si);
		this.emberGeo.setDrawRange(0, ei);
		this.firePoints.visible = fi > 0;
		this.smokePoints.visible = si > 0;
		this.emberPoints.visible = ei > 0;
		const fireMat = this.firePoints.material as THREE.PointsMaterial;
		const smokeMat = this.smokePoints.material as THREE.PointsMaterial;
		const emberMat = this.emberPoints.material as THREE.PointsMaterial;
		fireMat.size = pieces ? .38 : Math.max(2.4, engine.floorH * .85);
		smokeMat.size = pieces ? .85 : Math.max(4.2, engine.floorH * 1.4);
		emberMat.size = pieces ? .1 : 1.1;
		this.placeFlames(engine);
		if (heatN > 0) {
			const hx = heatX / (heatN + 1);
			const hy = heatY / (heatN + 1) + .5;
			const hz = heatZ / (heatN + 1);
			this.fireLight.position.set(hx, hy, hz);
			this.fireLight2.position.set(hx + .4, hy + .6, hz - .3);
			this.fireLight.intensity = pieces ? Math.min(36, 8 + heatN * .35) : Math.min(90, 18 + heatN * .5);
			this.fireLight2.intensity = this.fireLight.intensity * .45;
			this.fireLight.distance = pieces ? 12 : Math.max(36, engine.width * .9);
			this.fireLight2.distance = this.fireLight.distance * .7;
		} else {
			this.fireLight.intensity = 0;
			this.fireLight2.intensity = 0;
		}
		const pl = engine.plane;
		this.planeMesh.visible = pl.alive;
		if (pl.alive) {
			this.planeMesh.position.set(pl.x, pl.y, 0);
			this.planeMesh.rotation.z = -pl.angle;
			const s = Math.max(.35, engine.width / 70);
			this.planeMesh.scale.set(s, s, s);
		}
	}
	private placeFlames(engine: SimEngine): void {
		let n = 0;
		const t = engine.t;
		if (engine.isPieces) {
			const apt = engine.scenario.shape === "apartment";
			let frontZ = 0;
			if (apt) {
				for (const q of engine.pieces) if (q.kind === "wall" && q.z > frontZ) frontZ = q.z;
			}
			for (const p of engine.pieces) {
				if (n >= this.flames.length) break;
				if (p.burning < .22) continue;
				if (p.kind === "wall" || p.kind === "roof" || p.kind === "joist" || p.kind === "sill" || p.kind === "plate" || p.kind === "slab") continue;
				if (apt && p.kind === "column" && p.z < 0.05) continue;
				const spr = this.flames[n];
				const flick = .85 + .18 * Math.sin(t * 11 + p.id);
				const cap = p.kind === "tree" ? 1.05 : p.kind === "couch" ? 0.82 : p.kind === "log" ? 0.55 : 1.15;
				const base = p.kind === "tree" ? Math.min(cap, p.h * 0.55) : p.kind === "couch" ? Math.min(cap, p.h * 0.95) : Math.min(cap, p.h * 0.42);
				const h = Math.max(.22, base + p.burning * .18) * flick;
				const z = apt && p.kind === "column" ? frontZ + 0.12 : p.z;
				spr.position.set(p.x, p.y + h * .22, z);
				spr.scale.set(h * .4, h, 1);
				(spr.material as THREE.SpriteMaterial).opacity = .5 + p.burning * .32;
				spr.visible = true;
				n += 1;
			}
		}
		else {
			const stories: number[] = [];
			for (let i = 0; i < engine.floors.length; i++) {
				if (engine.floors[i].cols.some((c) => c.burning > .22)) stories.push(i);
			}
			stories.sort((a, b) => b - a);
			for (const i of stories) {
				if (n >= this.flames.length) break;
				const f = engine.floors[i];
				if (!f || f.state === "crushed") continue;
				const tf = floorTransform(engine, i, 0);
				const front = i + 1 >= engine.fireFloorAnnounced - 1;
				for (let c = 0; c < f.cols.length && n < this.flames.length; c++) {
					if (f.cols[c].burning < .22) continue;
					const spr = this.flames[n];
					const flick = .88 + .16 * Math.sin(t * 9 + i + c);
					const h = engine.floorH * (front ? 2.4 : 1.35) * (0.7 + f.cols[c].burning) * flick;
					const x = tf.x + (c - 2) * engine.width * .18;
					const z = (c % 3 - 1) * engine.width * .22;
					spr.position.set(x, tf.y + h * .32, z);
					spr.scale.set(h * .5, h, 1);
					(spr.material as THREE.SpriteMaterial).opacity = .48 + f.cols[c].burning * .45;
					spr.visible = true;
					n += 1;
				}
			}
		}
		for (let i = n; i < this.flames.length; i++) this.flames[i].visible = false;
	}
	private syncCgrav(engine: SimEngine): void {
		if (engine.phase === "idle" || engine.phase === "approach") {
			this.cgrav.visible = false;
			return;
		}
		this.cgrav.visible = true;
		const x = engine.width / 2 + engine.cgOffset();
		const y = Math.max(.2, engine.cgravY());
		const bot = engine.pit ? -engine.pit.depth : 0;
		const arr = this.cgrav.geometry.attributes.position as THREE.BufferAttribute;
		arr.setXYZ(0, x, y, 0);
		arr.setXYZ(1, x, bot, 0);
		arr.needsUpdate = true;
		(this.cgrav.material as THREE.LineBasicMaterial).color.setHex(Math.abs(engine.cgOffset()) < engine.width / 2 ? 0x3ecfc4 : 0xef5344);
	}
	private placeCameras(engine: SimEngine, timeSec: number): void {
		const W = engine.width;
		const H = Math.max(engine.height, 1.2);
		const cx = this.cx(engine);
		const shake = engine.reducedMotion ? 0 : engine.trauma * engine.trauma;
		const sx = Math.sin(timeSec * 41) * shake * 1.4;
		const sy = Math.cos(timeSec * 33) * shake * .8;
		const pit = engine.pit;
		const cgx = cx + (engine.phase === "idle" || engine.phase === "approach" ? 0 : engine.cgOffset());
		const fog = this.scene.fog as THREE.Fog;
		fog.color.setHex(HORIZON);
		fog.near = engine.isPieces ? 16 : Math.max(80, H * .9);
		fog.far = engine.isPieces ? 90 : Math.max(520, H * 3.4);
		const bonfire = engine.scenario.shape === "bonfire";
		const frontHalfW = engine.isPieces ? Math.max(W, pit ? 2.4 : W) * .72 : Math.max(W * .7, 18);
		const frontHalfH = bonfire
			? 1.45
			: engine.isPieces ? Math.max(1.4, H * .7 + (pit?.depth ?? 0) * .55) : Math.max(H * .58, 40);
		if (bonfire) {
			this.camFront.position.set(cx + sx * .1, 0.82, 9.5);
			this.camFront.up.set(0, 1, 0);
			this.camFront.lookAt(cx, 0.7, 0);
		} else {
			this.camFront.position.set(cx + sx * .1, engine.isPieces ? H * .2 : H * .42, Math.max(20, H * 2.2));
			this.camFront.up.set(0, 1, 0);
			this.camFront.lookAt(cx, engine.isPieces ? Math.max(.1, H * .12) : H * .42, 0);
		}
		this.camFront.near = engine.isPieces ? .2 : 2;
		this.camFront.far = engine.isPieces ? 80 : 5e3;
		this.camFront.userData.halfW = frontHalfW;
		this.camFront.userData.halfH = frontHalfH;
		const isoDist = bonfire
			? 8.2
			: engine.isPieces ? Math.max(16, Math.max(W, H + (pit?.depth ?? 0)) * 5.2) : Math.max(W * 4.4, H * 2.4);
		const isoY = bonfire ? 2.05 : engine.isPieces ? Math.max(2.8, H * .7) : Math.max(8, H * .1);
		this.camIso.near = engine.isPieces ? .12 : 2;
		this.camIso.far = engine.isPieces ? 120 : 5e3;
		this.camIso.position.set(cx + (bonfire ? 3.4 : W * .95) + sx, isoY + sy, isoDist * (bonfire ? 1 : .9));
		this.camIso.lookAt(cx, bonfire ? 0.55 : engine.isPieces ? Math.max(.12, H * .12) : H * .38, 0);
		const halfFov = ((bonfire ? 42 : 42) * Math.PI) / 360;
		const collapsing = !engine.isPieces && (engine.phase === "collapse" || engine.phase === "settled");
		const actionSpan = engine.isPieces
			? bonfire
				? 1.7
				: Math.max(W, H + (pit?.depth ?? 0)) * 1.2
			: Math.max(W * 0.85, engine.floorH * (collapsing ? 14 : 16));
		const zoomDist = actionSpan / Math.max(0.2, Math.tan(halfFov));
		this.camZoom.near = .12;
		this.camZoom.far = engine.isPieces ? 90 : 2500;
		this.camZoom.fov = bonfire ? 42 : 42;
		if (bonfire) {
			// Person standing back from the ring, eyes 1.65 m, looking at the
			// body of the fire — not down the well and not up from the coals.
			this.camZoom.position.set(engine.camX + 0.55, 1.65, 5.6);
			this.camZoom.up.set(0, 1, 0);
			this.camZoom.lookAt(engine.camX, 0.78, 0);
		} else {
			this.camZoom.position.set(
				engine.camX + sx * 0.3,
				engine.camY + actionSpan * (collapsing ? 0.14 : 0.06) + sy * 0.25,
				zoomDist,
			);
			this.camZoom.lookAt(engine.camX, engine.camY, 0);
			this.camZoom.lookAt(engine.camX, engine.camY, 0);
		}
		const topHalf = Math.max(W, pit ? 2.6 : W) * .62;
		this.camTop.position.set(cgx, Math.max(16, H * 1.7), 0);
		this.camTop.up.set(0, 0, -1);
		this.camTop.lookAt(cgx, 0, 0);
		this.camTop.near = .2;
		this.camTop.far = Math.max(50, H * 3.2);
		this.camTop.userData.halfW = topHalf;
		this.camTop.userData.halfH = topHalf;
	}
	project(wx: number, wy: number, pane: PaneRect, which: "front" | "iso" | "zoom" | "top"): { x: number; y: number } {
		const cam = which === "front" ? this.camFront : which === "iso" ? this.camIso : which === "zoom" ? this.camZoom : this.camTop;
		const v = new THREE.Vector3(wx, wy, 0);
		v.project(cam);
		return {
			x: (v.x * .5 + .5) * pane.w,
			y: (-v.y * .5 + .5) * pane.h
		};
	}
	render(engine: SimEngine, cssW: number, cssH: number, panes: { front: PaneRect; iso: PaneRect; zoom: PaneRect; top: PaneRect }, timeSec: number): void {
		this.rebuild(engine);
		this.syncPieces(engine);
		this.syncFloors(engine);
		this.syncParticles(engine);
		this.syncCgrav(engine);
		this.placeCameras(engine, timeSec);
		this.renderer.setSize(cssW, cssH, false);
		this.renderer.setScissorTest(false);
		this.renderer.setClearColor(HORIZON, 1);
		this.renderer.clear();
		this.renderer.setScissorTest(true);
		this.drawPane(this.camFront, panes.front, cssH);
		this.drawPane(this.camIso, panes.iso, cssH);
		this.drawPane(this.camZoom, panes.zoom, cssH);
		this.drawPane(this.camTop, panes.top, cssH);
		this.ready = true;
	}
	private drawPane(cam: THREE.Camera, pane: PaneRect, cssH: number): void {
		if (pane.w < 8 || pane.h < 8) return;
		const x = pane.x;
		const y = cssH - pane.y - pane.h;
		const aspect = pane.w / Math.max(pane.h, 1);
		if (cam instanceof THREE.PerspectiveCamera) {
			cam.aspect = aspect;
			cam.updateProjectionMatrix();
		} else if (cam instanceof THREE.OrthographicCamera) {
			const halfW = cam.userData.halfW ?? 10;
			const halfH = cam.userData.halfH ?? 10;
			let hw = halfW;
			let hh = halfH;
			if (hw / hh > aspect) hh = hw / aspect;
			else hw = hh * aspect;
			cam.left = -hw;
			cam.right = hw;
			cam.top = hh;
			cam.bottom = -hh;
			cam.updateProjectionMatrix();
		}
		this.renderer.setViewport(x, y, pane.w, pane.h);
		this.renderer.setScissor(x, y, pane.w, pane.h);
		this.renderer.clear();
		this.renderer.render(this.scene, cam);
	}
	dispose(): void {
		this.renderer.dispose();
		this.logQuarterGeo.dispose();
		this.logGeo.dispose();
		this.coneGeo.dispose();
		this.sphereGeo.dispose();
		this.boxGeo.dispose();
		this.fireGeo.dispose();
		this.smokeGeo.dispose();
		this.emberGeo.dispose();
		this.fireMap.dispose();
		this.smokeMap.dispose();
		this.flameMap.dispose();
		this.shingleMap.dispose();
		this.clapboardMap.dispose();
		this.frontFacadeMap.dispose();
		this.backFacadeMap.dispose();
		this.aptFrontMap.dispose();
		this.aptBackMap.dispose();
		this.grassMap.dispose();
		this.brickMap.dispose();
		this.towerFacadeMap.dispose();
		this.woodMat.dispose();
		this.steelMat.dispose();
		this.roofMat.dispose();
		this.sidingMat.dispose();
		this.frontMat.dispose();
		this.backMat.dispose();
		this.aptFrontMat.dispose();
		this.aptBackMat.dispose();
		this.plasterMat.dispose();
		if (this.floorMesh) this.floorMesh.dispose();
		for (const m of this.pieceMap.values()) {
			for (const mat of this.pieceMats(m)) mat.dispose();
		}
		for (const spr of this.flames) spr.material.dispose();
	}
}
