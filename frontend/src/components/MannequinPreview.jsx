import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function MannequinPreview({ outfit = [], gender = 'male' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 350;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0A090E'); // Matches --bg-primary

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 5.5);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight('#B794F4', 1.5, 10);
    pointLight.position.set(-2, 1, 2);
    scene.add(pointLight);

    // 5. Build Mannequin Group
    const mannequinGroup = new THREE.Group();
    scene.add(mannequinGroup);

    // Mannequin Material - Premium semi-glossy glass-like look
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: '#E2E8F0',
      roughness: 0.2,
      metalness: 0.1,
      transmission: 0.6, // Frosted glass look
      thickness: 1.2,
      transparent: true,
      opacity: 0.8
    });

    // Create the mannequin segments depending on gender proportions
    const isFemale = gender.lower === 'female' || gender === 'female';
    const shoulderWidth = isFemale ? 0.9 : 1.2;
    const hipWidth = isFemale ? 0.95 : 0.85;
    const waistWidth = isFemale ? 0.6 : 0.8;
    const chestHeight = 1.3;
    
    // Stand/Base
    const baseGeo = new THREE.CylinderGeometry(0.7, 0.8, 0.1, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#1A1D24', roughness: 0.5 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -1.9;
    mannequinGroup.add(baseMesh);

    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 16);
    const poleMesh = new THREE.Mesh(poleGeo, baseMat);
    poleMesh.position.set(0, -0.6, 0);
    mannequinGroup.add(poleMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 32, 32);
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headMesh.position.y = 1.2;
    mannequinGroup.add(headMesh);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.2, 16);
    const neckMesh = new THREE.Mesh(neckGeo, bodyMat);
    neckMesh.position.y = 0.88;
    mannequinGroup.add(neckMesh);

    // Torso / Chest
    const chestGeo = new THREE.CylinderGeometry(shoulderWidth / 2, waistWidth / 2, 0.7, 32);
    const chestMesh = new THREE.Mesh(chestGeo, bodyMat);
    chestMesh.position.y = 0.45;
    mannequinGroup.add(chestMesh);

    // Pelvis
    const pelvisGeo = new THREE.CylinderGeometry(waistWidth / 2, hipWidth / 2, 0.4, 32);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, bodyMat);
    pelvisMesh.position.y = -0.05;
    mannequinGroup.add(pelvisMesh);

    // Limbs - Left Leg
    const leftLegGeo = new THREE.CylinderGeometry(0.12, 0.08, 1.2, 16);
    const leftLegMesh = new THREE.Mesh(leftLegGeo, bodyMat);
    leftLegMesh.position.set(-0.25, -0.85, 0);
    mannequinGroup.add(leftLegMesh);

    // Right Leg
    const rightLegMesh = leftLegMesh.clone();
    rightLegMesh.position.x = 0.25;
    mannequinGroup.add(rightLegMesh);

    // Left Arm
    const leftArmGeo = new THREE.CylinderGeometry(0.08, 0.06, 1.0, 16);
    const leftArmMesh = new THREE.Mesh(leftArmGeo, bodyMat);
    leftArmMesh.position.set(-shoulderWidth / 2 - 0.06, 0.2, 0);
    leftArmMesh.rotation.z = 0.1;
    mannequinGroup.add(leftArmMesh);

    // Right Arm
    const rightArmMesh = leftArmMesh.clone();
    rightArmMesh.position.x = shoulderWidth / 2 + 0.06;
    rightArmMesh.rotation.z = -0.1;
    mannequinGroup.add(rightArmMesh);

    // 6. Clothing Layer Rendering
    const loadClothing = () => {
      // Clean previous clothing models if any
      const itemsToRemove = [];
      mannequinGroup.children.forEach(child => {
        if (child.isClothing) itemsToRemove.push(child);
      });
      itemsToRemove.forEach(child => mannequinGroup.remove(child));

      outfit.forEach(item => {
        const cat = item.category.toLowerCase();
        const colorVal = item.color || 'blue';
        const hasGlitter = item.texture_map === 'gold_glitter' || colorVal === 'gold';
        
        let garmentColor = '#FFFFFF';
        if (colorVal === 'white') garmentColor = '#F9FAFB';
        else if (colorVal === 'black') garmentColor = '#1F2937';
        else if (colorVal === 'navy') garmentColor = '#1E3A8A';
        else if (colorVal === 'charcoal') garmentColor = '#374151';
        else if (colorVal === 'indigo') garmentColor = '#312E81';
        else if (colorVal === 'beige') garmentColor = '#F59E0B';
        else if (colorVal === 'olive') garmentColor = '#065F46';
        else if (colorVal === 'camel') garmentColor = '#B45309';
        else if (colorVal === 'brown') garmentColor = '#78350F';
        else if (colorVal === 'gold') garmentColor = '#D97706';

        // Garment materials setup
        let clothMat;
        if (hasGlitter) {
          clothMat = new THREE.MeshPhysicalMaterial({
            color: '#EAB308',
            roughness: 0.1,
            metalness: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            sheen: 1.0,
            sheenColor: new THREE.Color('#FDE047')
          });
        } else {
          clothMat = new THREE.MeshStandardMaterial({
            color: garmentColor,
            roughness: 0.6,
            metalness: 0.1
          });
        }

        // Draw top
        if (cat === 'top') {
          const isDress = item.mesh_type === 'dress' || item.name.toLowerCase().includes('dress');
          const isCrop = item.mesh_type === 'crop_top' || item.name.toLowerCase().includes('crop');

          if (isDress) {
            // Render dress garment covering body to knees
            const dressGeo = new THREE.CylinderGeometry(shoulderWidth / 2 + 0.05, hipWidth / 2 + 0.15, 1.4, 32);
            const dressMesh = new THREE.Mesh(dressGeo, clothMat);
            dressMesh.position.y = 0.05;
            dressMesh.isClothing = true;
            mannequinGroup.add(dressMesh);
          } else if (isCrop) {
            // Crop top covering only top chest
            const cropGeo = new THREE.CylinderGeometry(shoulderWidth / 2 + 0.04, waistWidth / 2 + 0.03, 0.45, 32);
            const cropMesh = new THREE.Mesh(cropGeo, clothMat);
            cropMesh.position.y = 0.55;
            cropMesh.isClothing = true;
            mannequinGroup.add(cropMesh);
          } else {
            // Standard shirt covering chest and waist
            const topGeo = new THREE.CylinderGeometry(shoulderWidth / 2 + 0.04, waistWidth / 2 + 0.04, 0.75, 32);
            const topMesh = new THREE.Mesh(topGeo, clothMat);
            topMesh.position.y = 0.42;
            topMesh.isClothing = true;
            mannequinGroup.add(topMesh);

            // Sleeves
            const lSleeveGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 16);
            const lSleeveMesh = new THREE.Mesh(lSleeveGeo, clothMat);
            lSleeveMesh.position.set(-shoulderWidth / 2 - 0.06, 0.32, 0);
            lSleeveMesh.rotation.z = 0.1;
            lSleeveMesh.isClothing = true;
            mannequinGroup.add(lSleeveMesh);

            const rSleeveMesh = lSleeveMesh.clone();
            rSleeveMesh.position.x = shoulderWidth / 2 + 0.06;
            rSleeveMesh.rotation.z = -0.1;
            mannequinGroup.add(rSleeveMesh);
          }
        }

        // Draw bottoms (skirt or trousers)
        if (cat === 'bottom') {
          const isSkirt = item.name.toLowerCase().includes('skirt');
          if (isSkirt) {
            const skirtGeo = new THREE.CylinderGeometry(waistWidth / 2 + 0.04, hipWidth / 2 + 0.25, 0.75, 32);
            const skirtMesh = new THREE.Mesh(skirtGeo, clothMat);
            skirtMesh.position.y = -0.22;
            skirtMesh.isClothing = true;
            mannequinGroup.add(skirtMesh);
          } else {
            // Trousers / Jeans
            const legLeftGeo = new THREE.CylinderGeometry(0.14, 0.1, 1.15, 16);
            const legLeftMesh = new THREE.Mesh(legLeftGeo, clothMat);
            legLeftMesh.position.set(-0.25, -0.82, 0);
            legLeftMesh.isClothing = true;
            mannequinGroup.add(legLeftMesh);

            const legRightMesh = legLeftMesh.clone();
            legRightMesh.position.x = 0.25;
            mannequinGroup.add(legRightMesh);
          }
        }

        // Outerwear (Jackets/Coats)
        if (cat === 'outerwear') {
          const outerGeo = new THREE.CylinderGeometry(shoulderWidth / 2 + 0.08, hipWidth / 2 + 0.08, 0.9, 32);
          const outerMesh = new THREE.Mesh(outerGeo, clothMat);
          outerMesh.position.set(0, 0.38, 0.02);
          outerMesh.isClothing = true;
          mannequinGroup.add(outerMesh);
        }

        // Footwear (Shoes)
        if (cat === 'footwear') {
          const shoeGeo = new THREE.BoxGeometry(0.16, 0.12, 0.32);
          const shoeLeftMesh = new THREE.Mesh(shoeGeo, clothMat);
          shoeLeftMesh.position.set(-0.25, -1.5, 0.08);
          shoeLeftMesh.isClothing = true;
          mannequinGroup.add(shoeLeftMesh);

          const shoeRightMesh = shoeLeftMesh.clone();
          shoeRightMesh.position.x = 0.25;
          mannequinGroup.add(shoeRightMesh);
        }
      });
    };

    loadClothing();

    // 7. Interaction (Rotation & Zoom)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;

      mannequinGroup.rotation.y += deltaX * 0.007;
      mannequinGroup.rotation.x += deltaY * 0.007;
      // Clamp x rotation to prevent complete flipping
      mannequinGroup.rotation.x = Math.max(-0.5, Math.min(0.5, mannequinGroup.rotation.x));

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;

      mannequinGroup.rotation.y += deltaX * 0.008;
      mannequinGroup.rotation.x += deltaY * 0.008;
      mannequinGroup.rotation.x = Math.max(-0.5, Math.min(0.5, mannequinGroup.rotation.x));

      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.005;
      camera.position.z = Math.max(3.0, Math.min(8.0, camera.position.z));
    };

    const containerElement = containerRef.current;
    containerElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    containerElement.addEventListener('touchstart', handleTouchStart);
    containerElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleMouseUp);
    containerElement.addEventListener('wheel', handleWheel, { passive: false });

    // 8. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Auto-rotation when not dragging
      if (!isDragging) {
        mannequinGroup.rotation.y += 0.004;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 350;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Clean up
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      containerElement.removeEventListener('mousedown', handleMouseDown);
      containerElement.removeEventListener('touchstart', handleTouchStart);
      containerElement.removeEventListener('touchmove', handleTouchMove);
      containerElement.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(animationFrameId);
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      // Dispose geometries & materials
      scene.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => mat.dispose());
        } else {
          object.material.dispose();
        }
      });
    };
  }, [outfit, gender]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '350px', 
          borderRadius: '14px', 
          overflow: 'hidden', 
          cursor: 'grab', 
          border: '1px solid var(--border-color)',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }} 
      />
      <div style={{ 
        position: 'absolute', 
        bottom: '12px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        color: 'var(--text-secondary)', 
        fontSize: '0.65rem', 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        padding: '3px 8px', 
        borderRadius: '20px', 
        pointerEvents: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Drag to Rotate / Scroll to Zoom
      </div>
    </div>
  );
}
