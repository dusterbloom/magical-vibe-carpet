import * as THREE from 'three';
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerSpells } from './player/PlayerSpells';
import { PlayerInput } from './player/PlayerInput';
import { PlayerModels } from './player/PlayerModels';

export class PlayerSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.players = new Map();
    this.localPlayer = null;
    
    // World transition flag
    this.isTransitioning = false;
    this.transitionAlpha = 0;
    this.worldTransitionComplete = null;
    
    // Camera settings
    this.cameraSettings = {
      distance: 12,      // Distance behind player
      height: 5,         // Height above player
      lookAhead: 15,     // Look-ahead distance
      smoothing: 0.1     // Camera movement smoothing (0-1)
    };
    
    // Initialize subsystems
    this.physics = new PlayerPhysics(this);
    this.spells = new PlayerSpells(this);
    this.input = new PlayerInput(this);
    this.models = new PlayerModels(this);
  }
  
  async initialize() {
    // Initialize subsystems
    await this.models.initialize();
    await this.spells.initialize();
    
    // Listen for network events
    this.engine.systems.network.on('connected', (data) => {
      this.createLocalPlayer(data.id);
    });
    
    this.engine.systems.network.on('player_join', (data) => {
      this.createNetworkPlayer(data);
    });
    
    this.engine.systems.network.on('player_leave', (data) => {
      this.removePlayer(data.id);
    });
    
    this.engine.systems.network.on('player_update', (data) => {
      this.updateNetworkPlayer(data);
    });
    
    console.log("Player system initialized");
  }
  
  createLocalPlayer(id) {
    // Get a random carpet model
    const carpetModel = this.models.createCarpetModel();
    
    // Create player object
    const player = {
      id,
      isLocal: true,
      model: carpetModel,
      position: new THREE.Vector3(0, 50, 0), // Starting higher
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      acceleration: new THREE.Vector3(0, 0, 0),
      bankAngle: 0,
      mana: 0,
      health: 100,
      maxHealth: 100,
      maxSpeed: 100, // Increased for better mobility
      accelerationValue: 80, // Increased for better response
      rotationSpeed: 3, // Increased for better turning
      spells: [],
      altitude: 50, // Track target altitude
      altitudeVelocity: 0,
      currentSpell: 0,
      
      // Camera state
      cameraPosition: new THREE.Vector3(0, 0, 0),
      cameraLookAt: new THREE.Vector3(0, 0, 0)
    };
    
    // Add carpet model to scene
    carpetModel.position.copy(player.position);
    this.scene.add(carpetModel);
    
    // Store the player
    this.players.set(id, player);
    this.localPlayer = player;
    
    // Setup subsystems for local player
    this.input.setupInput();
    this.models.createCrosshair();
    this.updateCamera();
    
    console.log(`Local player created with ID: ${id}`);
  }
  
  createNetworkPlayer(data) {
    // Don't create duplicate players
    if (this.players.has(data.id)) {
      return;
    }
    
    // Get a random carpet model
    const carpetModel = this.models.createCarpetModel();
    
    // Create player object
    const player = {
      id: data.id,
      isLocal: false,
      model: carpetModel,
      position: new THREE.Vector3(data.x || 0, data.y || 20, data.z || 0),
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mana: 0,
      health: 100,
      maxHealth: 100
    };
    
    // Add carpet model to scene
    carpetModel.position.copy(player.position);
    this.scene.add(carpetModel);
    
    // Store the player
    this.players.set(data.id, player);
    
    console.log(`Network player created with ID: ${data.id}`);
  }
  
  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      // Remove model from scene
      this.scene.remove(player.model);
      
      // Remove player from collection
      this.players.delete(id);
      
      console.log(`Player removed with ID: ${id}`);
    }
  }
  
  updateNetworkPlayer(data) {
    const player = this.players.get(data.id);
    if (player && !player.isLocal) {
      // Update position with smoothing
      if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
        const targetPos = new THREE.Vector3(data.x, data.y, data.z);
        player.position.lerp(targetPos, 0.3);
      }
      
      // Update rotation with smoothing
      if (data.rotationY !== undefined) {
        player.rotation.y = THREE.MathUtils.lerp(
          player.rotation.y,
          data.rotationY,
          0.3
        );
      }
      
      // Update other properties
      if (data.mana !== undefined) player.mana = data.mana;
      if (data.health !== undefined) player.health = data.health;
    }
  }
  
  updateCamera() {
    if (!this.localPlayer) return;
    
    // Calculate ideal camera position based on player's position and rotation
    const settings = this.cameraSettings;
    
    // Create vectors for camera positioning
    const cameraOffset = new THREE.Vector3(0, settings.height, -settings.distance);
    const lookAheadOffset = new THREE.Vector3(0, 0, settings.lookAhead);
    
    // Apply player rotation to these vectors
    const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(this.localPlayer.rotation);
    cameraOffset.applyMatrix4(rotMatrix);
    lookAheadOffset.applyMatrix4(rotMatrix);
    
    // Calculate target camera position and look-at point
    const targetCameraPos = this.localPlayer.position.clone().add(cameraOffset);
    const targetLookAt = this.localPlayer.position.clone().add(lookAheadOffset);
    
    // Initialize camera position and lookAt if not already set
    if (!this.localPlayer.cameraPosition) {
      this.localPlayer.cameraPosition = targetCameraPos.clone();
    }
    if (!this.localPlayer.cameraLookAt) {
      this.localPlayer.cameraLookAt = targetLookAt.clone();
    }
    
    // Smoothly interpolate camera position and look-at point
    this.localPlayer.cameraPosition.lerp(targetCameraPos, settings.smoothing);
    this.localPlayer.cameraLookAt.lerp(targetLookAt, settings.smoothing);
    
    // Apply to engine camera
    this.engine.camera.position.copy(this.localPlayer.cameraPosition);
    this.engine.camera.lookAt(this.localPlayer.cameraLookAt);
  }
  
  updateTransition(delta) {
    // Update transition effect
    this.transitionAlpha += delta * 0.5; // Fade speed
    
    if (this.transitionAlpha >= 2.0) {
      // Transition is complete
      this.isTransitioning = false;
      this.transitionAlpha = 0;
      
      // Execute the world transition callback
      if (this.worldTransitionComplete) {
        this.worldTransitionComplete();
        this.worldTransitionComplete = null;
      }
      
      // Remove transition overlay
      const overlay = document.getElementById('transition-overlay');
      if (overlay) {
        document.body.removeChild(overlay);
      }
    } else {
      // Update transition overlay opacity
      const overlay = document.getElementById('transition-overlay');
      if (overlay) {
        // First half = fade to black, second half = fade from black
        const opacity = this.transitionAlpha <= 1.0 ? 
          this.transitionAlpha : 
          2.0 - this.transitionAlpha;
          
        overlay.style.opacity = opacity.toString();
      }
    }
  }
  
  checkWorldBoundaries() {
    if (!this.localPlayer || this.isTransitioning) return;
    
    const worldSize = this.engine.systems.world.worldSize;
    const halfSize = worldSize / 2 - 50; // Buffer from edge
    const { x, z } = this.localPlayer.position;
    
    // Check if player is beyond boundaries
    if (Math.abs(x) > halfSize || Math.abs(z) > halfSize) {
      this.startWorldTransition();
    }
  }
  
  startWorldTransition() {
    if (this.isTransitioning) return;
    
    // Create overlay for transition effect
    const overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.zIndex = '1000';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
    
    // Set transition state
    this.isTransitioning = true;
    this.transitionAlpha = 0;
    
    // Set callback for when transition reaches midpoint (full black)
    this.worldTransitionComplete = () => {
      // Generate a new random seed for the world
      this.engine.systems.world.seed = Math.random() * 1000;
      
      // Regenerate world
      this.engine.systems.world.createTerrain();
      this.engine.systems.world.createTerrainCollision();
      this.engine.systems.world.createManaNodes();
      
      // Move player to center of new world
      this.localPlayer.position.set(0, 50, 0);
      this.localPlayer.velocity.set(0, 0, 0);
    };
  }
  
  sendPlayerUpdate() {
    if (!this.localPlayer) return;
    
    const { position, rotation, mana, health } = this.localPlayer;
    
    this.engine.systems.network.sendPlayerUpdate({
      x: position.x,
      y: position.y,
      z: position.z,
      rotationY: rotation.y,
      mana,
      health
    });
  }
  
  update(delta) {
    if (!this.localPlayer) return;
    
    if (this.isTransitioning) {
      this.updateTransition(delta);
      return;
    }
    
    // Update subsystems
    this.input.handleInput(delta);
    this.physics.updatePhysics(delta);
    this.models.updateModels();
    this.spells.updateSpells(delta);
    
    // Check for mana collection
    this.checkManaCollection();
    
    // Update camera to follow player
    this.updateCamera();
    
    // Check world boundaries
    this.checkWorldBoundaries();
    
    // Send player updates to network
    this.sendPlayerUpdate();
  }
  
  checkManaCollection() {
    if (!this.localPlayer) return;
    
    // Collection radius
    const radius = 5;
    
    // Check for mana node collection
    const collectedNodes = this.engine.systems.world.checkManaCollection(
      this.localPlayer.position,
      radius
    );
    
    // Process collected nodes
    collectedNodes.forEach(node => {
      // Add mana to player
      this.localPlayer.mana += node.value;
      
      // Update UI
      if (this.engine.systems.ui) {
        this.engine.systems.ui.updateManaDisplay(this.localPlayer.mana);
      }
      
      // Create collection effect
      this.models.createManaCollectionEffect(node.position);
    });
  }
}
