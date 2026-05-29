import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const tileColor = 0xdbe4e2
const accentColor = 0xf2b84b
const glassColor = 0x8fe8f2

function box(scene, size, position, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

function cylinder(scene, radiusTop, radiusBottom, height, position, rotation, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 40), material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

function tileGrid(width, height, columns, rows, position, material) {
  const points = []
  for (let column = 0; column <= columns; column += 1) {
    const x = -width / 2 + (width * column) / columns
    points.push(x, -height / 2, 0, x, height / 2, 0)
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = -height / 2 + (height * row) / rows
    points.push(-width / 2, y, 0, width / 2, y, 0)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const lines = new THREE.LineSegments(geometry, material)
  lines.position.set(...position)
  return lines
}

export default function ThreeBathroomShowroom() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x061011, 7, 15)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0.45, 0.55, 6.4)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const room = new THREE.Group()
    room.position.set(1.25, -0.05, -0.15)
    room.rotation.y = -0.3
    scene.add(room)

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xbfcac8, roughness: 0.52, metalness: 0.05 })
    const wallMaterial = new THREE.MeshStandardMaterial({ color: tileColor, roughness: 0.62, metalness: 0.03 })
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x101819, roughness: 0.46, metalness: 0.16 })
    const goldMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.32, metalness: 0.55 })
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xf3eee5, roughness: 0.5, metalness: 0.04 })
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: glassColor,
      emissive: 0x145b63,
      emissiveIntensity: 0.26,
      roughness: 0.12,
      metalness: 0.04,
      transparent: true,
      opacity: 0.68,
    })
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: glassColor,
      roughness: 0.02,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
      transmission: 0.45,
      thickness: 0.18,
    })
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff0c8,
      emissiveIntensity: 1.1,
      roughness: 0.25,
    })
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })

    box(room, [6.2, 0.12, 4.8], [0, -1.42, 0], floorMaterial, false)
    box(room, [6.2, 3.2, 0.12], [0, 0.14, -2.36], wallMaterial, false)
    box(room, [0.12, 3.2, 4.8], [-3.05, 0.14, 0], wallMaterial, false)
    room.add(tileGrid(6.05, 3.05, 9, 5, [0, 0.16, -2.285], lineMaterial))
    const sideGrid = tileGrid(4.65, 3.05, 7, 5, [0, 0.16, 0], lineMaterial)
    sideGrid.rotation.y = Math.PI / 2
    sideGrid.position.x = -2.985
    room.add(sideGrid)

    box(room, [1.54, 0.76, 0.52], [-1.7, -1.0, -1.75], darkMaterial)
    box(room, [1.7, 0.15, 0.62], [-1.7, -0.55, -1.75], stoneMaterial)
    cylinder(room, 0.27, 0.18, 0.12, [-1.7, -0.46, -1.75], [Math.PI / 2, 0, 0], stoneMaterial)
    cylinder(room, 0.035, 0.035, 0.42, [-1.42, -0.28, -1.78], [0, 0, 0], goldMaterial)
    cylinder(room, 0.3, 0.3, 0.035, [-1.7, 0.45, -2.26], [Math.PI / 2, 0, 0], lightMaterial)
    cylinder(room, 0.44, 0.44, 0.025, [-1.7, 0.45, -2.245], [Math.PI / 2, 0, 0], glassMaterial)
    box(room, [1.4, 0.05, 0.06], [-1.7, 1.02, -2.26], lightMaterial, false)

    box(room, [1.8, 0.18, 0.84], [1.32, -1.15, -1.34], stoneMaterial)
    box(room, [1.52, 0.14, 0.54], [1.32, -1.03, -1.34], waterMaterial, false)
    cylinder(room, 0.52, 0.52, 0.08, [1.32, -0.92, -1.34], [Math.PI / 2, 0, 0], stoneMaterial)

    box(room, [1.35, 2.15, 0.05], [0.9, -0.12, -2.05], glassMaterial, false)
    box(room, [0.05, 2.15, 1.3], [1.55, -0.12, -1.42], glassMaterial, false)
    cylinder(room, 0.04, 0.04, 0.86, [0.78, 0.72, -2.0], [0, 0, Math.PI / 2], goldMaterial)
    cylinder(room, 0.22, 0.22, 0.045, [0.36, 0.72, -2.0], [Math.PI / 2, 0, 0], goldMaterial)

    const drops = []
    const dropMaterial = new THREE.MeshStandardMaterial({
      color: 0xbaf6ff,
      emissive: 0x1c7d86,
      emissiveIntensity: 0.46,
      transparent: true,
      opacity: 0.74,
    })
    for (let index = 0; index < 34; index += 1) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.012, 10, 10), dropMaterial)
      drop.position.set(0.18 + Math.random() * 0.38, 0.42 - Math.random() * 1.3, -1.95 + Math.random() * 0.22)
      drop.userData.speed = 0.012 + Math.random() * 0.016
      drop.userData.top = 0.48 + Math.random() * 0.16
      room.add(drop)
      drops.push(drop)
    }

    const particleGeometry = new THREE.BufferGeometry()
    const particlePositions = []
    for (let index = 0; index < 90; index += 1) {
      particlePositions.push((Math.random() - 0.5) * 5.6, -1.18 + Math.random() * 2.65, -2.2 + Math.random() * 4)
    }
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3))
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xf2b84b, size: 0.018, transparent: true, opacity: 0.55 }),
    )
    room.add(particles)

    const ambient = new THREE.AmbientLight(0x96b7b7, 1.4)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xfff1d0, 3)
    key.position.set(-2.2, 4.4, 4.3)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)

    const rim = new THREE.PointLight(0x5ee8ff, 2.6, 10)
    rim.position.set(3.2, 1.8, 1.5)
    scene.add(rim)

    const warm = new THREE.PointLight(0xf2b84b, 1.8, 8)
    warm.position.set(-2.6, 1.2, 1.4)
    scene.add(warm)

    const pointer = { x: 0, y: 0 }
    const handlePointer = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', handlePointer)

    const resize = () => {
      const width = mount.clientWidth || 1
      const height = mount.clientHeight || 1
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.position.z = width < 700 ? 7.4 : 6.4
      camera.position.x = width < 700 ? 0.2 : 0.45
      room.position.x = width < 700 ? 0.85 : 1.25
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    let frame = 0
    let animationId = 0
    const animate = () => {
      frame += 0.01
      room.rotation.y = -0.33 + Math.sin(frame) * 0.035 + pointer.x * 0.045
      room.rotation.x = -0.025 + pointer.y * 0.025
      particles.rotation.y += 0.0018
      particles.rotation.x = Math.sin(frame * 0.6) * 0.03

      drops.forEach((drop) => {
        drop.position.y -= drop.userData.speed
        if (drop.position.y < -0.88) {
          drop.position.y = drop.userData.top
        }
      })

      renderer.render(scene, camera)
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointer)
      mount.removeChild(renderer.domElement)
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
    }
  }, [])

  return <div className="three-showroom" ref={mountRef} />
}
