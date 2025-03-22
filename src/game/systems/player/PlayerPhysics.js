import * as THREE from 'three';

export class PlayerPhysics {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    
    // Physics constants
    this.gravity = 9.8;
    this.minAltitude = 5;
    this.maxAltitude = 300;  // Increased max altitude
    this.dragCoefficient = 0.15; // Reduced drag for faster movement
    this.altitudeDamping = 0.9;  // Increased for smoother altitude changes
    
    // Carpet movement physics
    this.carpetInertia = 0.95;       // Higher = more floaty/drifty (increased)
    this.carpetTurnInertia = 0.9;    // Higher = slower to turn (increased)
    this.carpetMaxSpeed = 100;       // Maximum speed (increased)
    this.carpetTiltFactor = 0.2;     // Visual tilt when turning (increased)
    this.carpetBankingFactor = 0.12; // Banking effect when turning (increased)
    
    // Debug flag
    this.debugPhysics = true;
  }
  
  updatePhysics(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    // Apply forces to acceleration
    this.applyForces(player, delta);
    
    // Update velocity based on acceleration
    player.velocity.add(player.acceleration.clone().multiplyScalar(delta));
    
    // Apply carpet inertia (smoother movement)
    player.velocity.multiplyScalar(this.carpetInertia);
    
    // Limit maximum speed
    const currentSpeed = player.velocity.length();
    if (currentSpeed > this.carpetMaxSpeed) {
      player.velocity.multiplyScalar(this.carpetMaxSpeed / currentSpeed);
    }
    
    // Apply velocity to position
    const movement = player.velocity.clone().multiplyScalar(delta);
    player.position.add(movement);
    
    if (this.debugPhysics && movement.length() > 0.01) {
      console.log(`Player moved: ${movement.x.toFixed(2)}, ${movement.y.toFixed(2)}, ${movement.z.toFixed(2)}`);
      console.log(`Player position: ${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)}`);
    }
    
    // Apply altitude controls and constraints
    this.updateAltitude(player, delta);
    
    // Apply carpet tilt based on movement
    this.updateCarpetTilt(player, delta);
    
    // Reset acceleration for next frame
    player.acceleration.set(0, 0, 0);
  }
  
  applyForces(player, delta) {
    // Apply gravity (reduced for carpet floating effect)
    player.acceleration.y -= this.gravity * 0.4 * delta; // Reduced gravity effect
    
    // Apply banking forces (if player is tilting/turning)
    if (Math.abs(player.bankAngle) > 0.01) {
      // Gradually reduce bank angle with inertia
      player.bankAngle *= this.carpetTurnInertia;
      
      // Apply sideways force proportional to bank angle
      const sidewaysForce = player.bankAngle * this.carpetBankingFactor;
      
      // Get right vector
      const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
      
      // Apply force in the right direction
      player.acceleration.addScaledVector(rightVector, sidewaysForce);
    }
    
    // Apply terrain avoidance - push up if too close to ground
    const terrainHeight = this.engine.systems.world.getTerrainHeight(
      player.position.x,
      player.position.z
    );
    
    const heightAboveTerrain = player.position.y - terrainHeight;
    const minSafeHeight = 5;
    
    if (heightAboveTerrain < minSafeHeight) {
      // Strong upward force when close to terrain
      const avoidanceForce = (minSafeHeight - heightAboveTerrain) * 10; // Increased force
      player.acceleration.y += avoidanceForce;
    }
    
    // Apply air resistance (drag) - more at higher speeds
    const dragForce = player.velocity.clone().multiplyScalar(-this.dragCoefficient * player.velocity.length());
    player.acceleration.add(dragForce);
  }
  
  updateAltitude(player, delta) {
    // Apply altitude changes from user input with smooth transitions
    player.position.y += player.altitudeVelocity * delta;
    
    // Apply damping to altitude velocity for smoother transitions
    player.altitudeVelocity *= this.altitudeDamping;
    
    // Enforce minimum altitude (above terrain)
    const terrainHeight = this.engine.systems.world.getTerrainHeight(
      player.position.x,
      player.position.z
    );
    
    const minHeightAboveTerrain = Math.max(this.minAltitude, terrainHeight + 5);
    
    if (player.position.y < minHeightAboveTerrain) {
      player.position.y = minHeightAboveTerrain;
      
      // Stop downward velocity
      if (player.velocity.y < 0) {
        player.velocity.y = 0;
      }
      
      // Bounce effect when hitting ground
      if (player.altitudeVelocity < -10) {
        player.altitudeVelocity = -player.altitudeVelocity * 0.3; // Bounce with 30% of impact velocity
      } else {
        player.altitudeVelocity = 0;
      }
    }
    
    // Enforce maximum altitude
    if (player.position.y > this.maxAltitude) {
      player.position.y = this.maxAltitude;
      
      // Stop upward velocity
      if (player.velocity.y > 0) {
        player.velocity.y = 0;
      }
      
      player.altitudeVelocity = 0;
    }
  }
  
  updateCarpetTilt(player, delta) {
    if (!player.model) return;
    
    // Find carpet mesh in the model
    if (!player.carpetMesh) {
      player.model.traverse((child) => {
        if (child.isMesh && child.name.includes('carpet')) {
          player.carpetMesh = child;
        }
      });
    }
    
    if (!player.carpetMesh) return;
    
    // Calculate carpet tilt based on movement direction and speed
    const forwardSpeed = new THREE.Vector3(0, 0, 1)
      .applyEuler(player.rotation)
      .dot(player.velocity);
    
    const rightSpeed = new THREE.Vector3(1, 0, 0)
      .applyEuler(player.rotation)
      .dot(player.velocity);
    
    // Apply pitch (forward/backward tilt)
    const targetPitch = -forwardSpeed * 0.01 * this.carpetTiltFactor;
    player.carpetPitch = THREE.MathUtils.lerp(player.carpetPitch || 0, targetPitch, 0.1);
    
    // Apply roll (side-to-side tilt)
    // Use player.bankAngle for more consistent banking in turns
    const targetRoll = player.bankAngle || (rightSpeed * 0.02 * this.carpetTiltFactor);
    player.carpetRoll = THREE.MathUtils.lerp(player.carpetRoll || 0, targetRoll, 0.1);
    
    // Apply visual tilt to carpet mesh
    player.carpetMesh.rotation.x = player.carpetPitch;
    player.carpetMesh.rotation.z = player.carpetRoll;
  }
  
  // Helper methods for adding forces
  applyForwardForce(player, force) {
    // Calculate forward direction based on player's rotation
    const forwardVector = new THREE.Vector3(0, 0, 1).applyEuler(player.rotation);
    
    // Apply force in the forward direction
    player.acceleration.addScaledVector(forwardVector, force);
    
    if (this.debugPhysics && Math.abs(force) > 0.1) {
      console.log(`Applied forward force: ${force.toFixed(2)}`);
      console.log(`Forward vector: ${forwardVector.x.toFixed(2)}, ${forwardVector.y.toFixed(2)}, ${forwardVector.z.toFixed(2)}`);
      console.log(`Acceleration: ${player.acceleration.x.toFixed(2)}, ${player.acceleration.y.toFixed(2)}, ${player.acceleration.z.toFixed(2)}`);
    }
    
    // Apply visual effect - carpet tilts forward slightly when accelerating
    if (player.carpetMesh) {
      player.targetCarpetPitch = -force * 0.01;
    }
  }
  
  applySideForce(player, force) {
    // Calculate right direction based on player's rotation
    const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
    
    // Apply force in the right direction
    player.acceleration.addScaledVector(rightVector, force);
    
    if (this.debugPhysics && Math.abs(force) > 0.1) {
      console.log(`Applied side force: ${force.toFixed(2)}`);
      console.log(`Right vector: ${rightVector.x.toFixed(2)}, ${rightVector.y.toFixed(2)}, ${rightVector.z.toFixed(2)}`);
    }
    
    // Apply banking effect for turns
    const maxBankAngle = Math.PI / 4; // 45 degrees (increased)
    player.bankAngle = THREE.MathUtils.clamp(
      player.bankAngle + force * 0.02, // Increased banking effect
      -maxBankAngle,
      maxBankAngle
    );
    
    // Apply visual effect - carpet tilts sideways when turning
    if (player.carpetMesh) {
      player.targetCarpetRoll = force * 0.03; // Increased visual effect
    }
  }
  
  applyAltitudeChange(player, force) {
    // Smoother altitude changes with acceleration
    player.altitudeVelocity += force;
    
    if (this.debugPhysics && Math.abs(force) > 0.1) {
      console.log(`Applied altitude force: ${force.toFixed(2)}`);
      console.log(`Altitude velocity: ${player.altitudeVelocity.toFixed(2)}`);
    }
    
    // Limit maximum altitude velocity
    const maxAltitudeVelocity = 60; // Increased for faster vertical movement
    player.altitudeVelocity = THREE.MathUtils.clamp(
      player.altitudeVelocity,
      -maxAltitudeVelocity,
      maxAltitudeVelocity
    );
  }
}
