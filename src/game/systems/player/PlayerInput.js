import * as THREE from 'three';

export class PlayerInput {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    
    // Input sensitivity settings
    this.mouseSensitivity = 0.002;
    this.touchSensitivity = 0.5;
    
    // Modern flying controls settings
    this.mouseControlEnabled = true;
    this.mouseYawControl = true;     // Allow mouse to control yaw (left/right)
    this.mousePitchControl = true;   // Allow mouse to control pitch (up/down)
    this.autoLevelingEnabled = true; // Auto-level when no input
    this.autoLevelingSpeed = 0.5;    // Speed of auto-leveling (0-1)
    this.boostMultiplier = 2.0;      // Speed boost multiplier
    this.boosting = false;           // Current boost state
    
    // Touch controls state
    this.joystick = null;
    this.touchRotation = {
      active: false,
      lastX: 0,
      lastY: 0
    };
    this.touchAltitude = {
      up: false,
      down: false
    };
    
    // Carpet movement settings
    this.baseAcceleration = 80;      // Increased base acceleration
    this.turnSensitivity = 3.0;      // How quickly the carpet turns
    this.bankingFactor = 0.8;        // How much the carpet banks in turns
    
    // Mouse control state
    this.mouseControlState = {
      yawInfluence: 0,               // -1 to 1, left to right
      pitchInfluence: 0,             // -1 to 1, up to down
      centerX: 0,                    // Center position for relative mouse control
      centerY: 0
    };
    
    // Movement state
    this.movementState = {
      forward: 0,
      right: 0,
      up: 0
    };
    
    // Debug flag - set to true to see input logs
    this.debugInput = true;
  }
  
  setupInput() {
    const input = this.engine.input;
    
    // Handle mouse move for camera and flight control
    input.on('mousemove', (event) => {
      if (this.playerSystem.localPlayer) {
        if (input.pointerLocked) {
          // Pointer lock mode - use movement for rotation
          this.handlePointerLockedRotation(input.mouse.dx, input.mouse.dy);
        } else if (input.mouse.buttons & 1) { // Left mouse button held
          // Dragging mode - use mouse position difference for rotation
          this.handleDragRotation(input.mouse.dx, input.mouse.dy);
        } else if (this.mouseControlEnabled) {
          // Modern flying control - use mouse position relative to center
          this.handleMouseFlyingControl(input.mouse.x, input.mouse.y);
        }
      }
    });
    
    // Handle mouse click for shooting and control
    input.on('mousedown', (event) => {
      if (this.playerSystem.localPlayer && event.button === 0) {
        if (!input.pointerLocked) {
          // First click just focuses control if not in pointer lock
          this.engine.canvas.focus();
          
          // Store center position for relative mouse control
          const rect = this.engine.canvas.getBoundingClientRect();
          this.mouseControlState.centerX = rect.width / 2;
          this.mouseControlState.centerY = rect.height / 2;
        } else {
          // Cast spell if in pointer lock mode
          this.playerSystem.spells.castSpell();
        }
      }
    });
    
    // Handle keyboard input
    input.on('keydown', (event) => {
      // Log key presses in debug mode
      if (this.debugInput) {
        console.log(`PlayerInput received keydown: ${event.code}`);
      }
      
      // Prevent default for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'].includes(event.code)) {
        event.preventDefault();
      }
      
      // Toggle boost with Shift
      if (event.code === 'ShiftLeft') {
        this.boosting = true;
      }
      
      // Spell selection with number keys
      if (event.code >= 'Digit1' && event.code <= 'Digit3') {
        const spellIndex = parseInt(event.code.replace('Digit', '')) - 1;
        this.playerSystem.spells.selectSpell(spellIndex);
      }
      
      // Update movement state based on key presses
      this.updateMovementStateFromKeyboard(input);
    });
    
    // Handle key up events
    input.on('keyup', (event) => {
      // Turn off boost when Shift is released
      if (event.code === 'ShiftLeft') {
        this.boosting = false;
      }
      
      // Update movement state based on key presses
      this.updateMovementStateFromKeyboard(input);
    });
    
    // Handle touch input for mobile
    if (input.isTouchDevice) {
      this.setupTouchControls();
    }
    
    // Enable debug mode in InputManager if needed
    input.debugInput = this.debugInput;
    
    console.log("Player input system initialized");
  }
  
  updateMovementStateFromKeyboard(input) {
    // Reset movement state
    this.movementState.forward = 0;
    this.movementState.right = 0;
    this.movementState.up = 0;
    
    // Forward/back movement (W/S or Up/Down)
    if (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) {
      this.movementState.forward += 1;
      if (this.debugInput) {
        console.log("Moving forward");
      }
    }
    if (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) {
      this.movementState.forward -= 1;
      if (this.debugInput) {
        console.log("Moving backward");
      }
    }
    
    // Left/right movement (A/D or Left/Right)
    if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) {
      this.movementState.right += 1;
      if (this.debugInput) {
        console.log("Moving right");
      }
    }
    if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) {
      this.movementState.right -= 1;
      if (this.debugInput) {
        console.log("Moving left");
      }
    }
    
    // Up/down movement (Space/Ctrl)
    if (input.isKeyDown('Space')) {
      this.movementState.up += 1;
      if (this.debugInput) {
        console.log("Moving up");
      }
    }
    if (input.isKeyDown('ControlLeft') || input.isKeyDown('ControlRight')) {
      this.movementState.up -= 1;
      if (this.debugInput) {
        console.log("Moving down");
      }
    }
  }
  
  handlePointerLockedRotation(dx, dy) {
    const player = this.playerSystem.localPlayer;
    
    // Rotate player based on mouse movement
    player.rotation.y -= dx * this.mouseSensitivity;
    
    // Limit vertical look
    const newPitch = player.rotation.x - dy * this.mouseSensitivity;
    player.rotation.x = THREE.MathUtils.clamp(
      newPitch, 
      -Math.PI / 3, // Increased range for better control
      Math.PI / 3
    );
  }
  
  handleDragRotation(dx, dy) {
    const player = this.playerSystem.localPlayer;
    
    // Rotate player based on mouse drag (with adjusted sensitivity)
    player.rotation.y -= dx * this.mouseSensitivity * 0.5;
    
    // Limit vertical look with smoother movement
    const newPitch = player.rotation.x - dy * this.mouseSensitivity * 0.5;
    player.rotation.x = THREE.MathUtils.clamp(
      newPitch, 
      -Math.PI / 3, // Increased range for better control
      Math.PI / 3
    );
  }
  
  handleMouseFlyingControl(mouseX, mouseY) {
    // Skip if mouse control is disabled
    if (!this.mouseControlEnabled) return;
    
    // Calculate mouse position relative to center of screen
    const centerX = this.mouseControlState.centerX || window.innerWidth / 2;
    const centerY = this.mouseControlState.centerY || window.innerHeight / 2;
    
    // Calculate normalized influence (-1 to 1)
    // Use a non-linear curve for better control at center
    const normalizeWithDeadzone = (value, center, deadzone = 0.1) => {
      const delta = (value - center) / center;
      const absDelta = Math.abs(delta);
      
      if (absDelta < deadzone) return 0;
      
      // Apply non-linear curve for better precision
      const sign = Math.sign(delta);
      const normalized = sign * Math.pow((absDelta - deadzone) / (1 - deadzone), 2);
      
      return THREE.MathUtils.clamp(normalized, -1, 1);
    };
    
    // Update mouse control state
    if (this.mouseYawControl) {
      this.mouseControlState.yawInfluence = normalizeWithDeadzone(mouseX, centerX);
    }
    
    if (this.mousePitchControl) {
      this.mouseControlState.pitchInfluence = normalizeWithDeadzone(mouseY, centerY);
    }
  }
  
  handleInput(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    const input = this.engine.input;
    const physics = this.playerSystem.physics;
    
    // Get movement input from current state
    let forward = this.movementState.forward;
    let right = this.movementState.right;
    let up = this.movementState.up;
    
    // Apply mouse influence to movement (modern flying control)
    if (this.mouseControlEnabled) {
      // Apply yaw (left/right) influence from mouse
      if (this.mouseYawControl && Math.abs(this.mouseControlState.yawInfluence) > 0.05) {
        right += this.mouseControlState.yawInfluence * this.turnSensitivity;
      }
      
      // Apply pitch (up/down) influence from mouse
      if (this.mousePitchControl && Math.abs(this.mouseControlState.pitchInfluence) > 0.05) {
        // Invert Y axis for more intuitive control (mouse down = nose down)
        const pitchInfluence = -this.mouseControlState.pitchInfluence;
        
        // Apply pitch to player rotation
        const targetPitch = pitchInfluence * (Math.PI / 3); // Max 60 degrees pitch
        player.rotation.x = THREE.MathUtils.lerp(
          player.rotation.x,
          targetPitch,
          0.1 // Smooth transition
        );
      } else if (this.autoLevelingEnabled) {
        // Auto-level when no pitch input
        player.rotation.x = THREE.MathUtils.lerp(
          player.rotation.x,
          0,
          this.autoLevelingSpeed * delta * 5
        );
      }
    }
    
    // Handle touch controls if active
    if (this.joystick && this.joystick.active) {
      // Get joystick values (-1 to 1 range)
      const jx = this.joystick.position.x;
      const jy = this.joystick.position.y;
      
      // Apply joystick values with exponential response for better control
      // This makes small movements more precise while still allowing full speed
      forward += -jy * Math.abs(jy) * this.touchSensitivity; // Forward is -y in joystick
      right += jx * Math.abs(jx) * this.touchSensitivity;
    }
    
    // Handle altitude touch controls
    if (this.touchAltitude.up) {
      up += 1;
    }
    if (this.touchAltitude.down) {
      up -= 1;
    }
    
    // Apply speed boost if active
    const speedMultiplier = this.boosting ? this.boostMultiplier : 1.0;
    
    // Calculate acceleration based on current speed for more natural movement
    // This creates a "wind resistance" effect at higher speeds
    const currentSpeed = player.velocity.length();
    const speedFactor = 1 - (currentSpeed / (physics.carpetMaxSpeed * speedMultiplier)) * 0.7;
    const acceleration = this.baseAcceleration * speedFactor * speedMultiplier;
    
    // Debug output for movement
    if (this.debugInput && (forward !== 0 || right !== 0 || up !== 0)) {
      console.log(`Movement: forward=${forward}, right=${right}, up=${up}, accel=${acceleration}`);
    }
    
    // Apply forward/back acceleration (camera-relative)
    if (forward !== 0) {
      physics.applyForwardForce(player, acceleration * forward * delta);
      
      if (this.debugInput) {
        console.log(`Applying forward force: ${acceleration * forward * delta}`);
        console.log(`Player velocity after: ${player.velocity.x}, ${player.velocity.y}, ${player.velocity.z}`);
      }
    } else {
      // Auto-forward: always move forward slightly when no input
      // This makes the carpet feel more like it's flying rather than hovering
      physics.applyForwardForce(player, acceleration * 0.2 * delta);
    }
    
    // Apply left/right acceleration (camera-relative)
    if (right !== 0) {
      physics.applySideForce(player, acceleration * right * delta);
      
      // Apply banking effect for turns (visual effect)
      const bankAngle = -right * this.bankingFactor;
      player.bankAngle = THREE.MathUtils.lerp(
        player.bankAngle || 0,
        bankAngle,
        0.1
      );
    } else if (player.bankAngle) {
      // Return to level flight when no input
      player.bankAngle = THREE.MathUtils.lerp(
        player.bankAngle,
        0,
        0.05
      );
    }
    
    // Apply up/down movement with smooth acceleration
    if (up !== 0) {
      physics.applyAltitudeChange(player, 60 * up * delta * speedMultiplier);
    }
  }
  
  setupTouchControls() {
    const input = this.engine.input;
    
    // Create virtual joystick for mobile
    const joystickContainer = document.createElement('div');
    joystickContainer.style.position = 'absolute';
    joystickContainer.style.bottom = '20px';
    joystickContainer.style.left = '20px';
    joystickContainer.style.width = '120px';
    joystickContainer.style.height = '120px';
    joystickContainer.style.borderRadius = '60px';
    joystickContainer.style.background = 'rgba(255, 255, 255, 0.2)';
    joystickContainer.style.touchAction = 'none';
    document.body.appendChild(joystickContainer);
    
    const joystick = document.createElement('div');
    joystick.style.position = 'absolute';
    joystick.style.top = '35px';
    joystick.style.left = '35px';
    joystick.style.width = '50px';
    joystick.style.height = '50px';
    joystick.style.borderRadius = '25px';
    joystick.style.background = 'rgba(255, 255, 255, 0.5)';
    joystickContainer.appendChild(joystick);
    
    // Create rotation area (right side of screen)
    const rotationArea = document.createElement('div');
    rotationArea.style.position = 'absolute';
    rotationArea.style.top = '0';
    rotationArea.style.right = '0';
    rotationArea.style.width = '50%';
    rotationArea.style.height = '100%';
    rotationArea.style.touchAction = 'none';
    document.body.appendChild(rotationArea);
    
    // Create altitude controls
    const altUpButton = document.createElement('div');
    altUpButton.style.position = 'absolute';
    altUpButton.style.bottom = '150px';
    altUpButton.style.right = '20px';
    altUpButton.style.width = '60px';
    altUpButton.style.height = '60px';
    altUpButton.style.borderRadius = '30px';
    altUpButton.style.background = 'rgba(255, 255, 255, 0.5)';
    altUpButton.style.display = 'flex';
    altUpButton.style.alignItems = 'center';
    altUpButton.style.justifyContent = 'center';
    altUpButton.style.fontSize = '24px';
    altUpButton.textContent = '↑';
    altUpButton.style.touchAction = 'none';
    document.body.appendChild(altUpButton);
    
    const altDownButton = document.createElement('div');
    altDownButton.style.position = 'absolute';
    altDownButton.style.bottom = '80px';
    altDownButton.style.right = '20px';
    altDownButton.style.width = '60px';
    altDownButton.style.height = '60px';
    altDownButton.style.borderRadius = '30px';
    altDownButton.style.background = 'rgba(255, 255, 255, 0.5)';
    altDownButton.style.display = 'flex';
    altDownButton.style.alignItems = 'center';
    altDownButton.style.justifyContent = 'center';
    altDownButton.style.fontSize = '24px';
    altDownButton.textContent = '↓';
    altDownButton.style.touchAction = 'none';
    document.body.appendChild(altDownButton);
    
    // Create fire button
    const fireButton = document.createElement('div');
    fireButton.style.position = 'absolute';
    fireButton.style.bottom = '80px';
    fireButton.style.right = '100px';
    fireButton.style.width = '80px';
    fireButton.style.height = '80px';
    fireButton.style.borderRadius = '40px';
    fireButton.style.background = 'rgba(255, 0, 0, 0.5)';
    fireButton.style.display = 'flex';
    fireButton.style.alignItems = 'center';
    fireButton.style.justifyContent = 'center';
    fireButton.style.fontSize = '16px';
    fireButton.textContent = 'FIRE';
    fireButton.style.touchAction = 'none';
    document.body.appendChild(fireButton);
    
    // Create boost button
    const boostButton = document.createElement('div');
    boostButton.style.position = 'absolute';
    boostButton.style.bottom = '150px';
    boostButton.style.right = '100px';
    boostButton.style.width = '80px';
    boostButton.style.height = '80px';
    boostButton.style.borderRadius = '40px';
    boostButton.style.background = 'rgba(255, 255, 0, 0.5)';
    boostButton.style.display = 'flex';
    boostButton.style.alignItems = 'center';
    boostButton.style.justifyContent = 'center';
    boostButton.style.fontSize = '16px';
    boostButton.textContent = 'BOOST';
    boostButton.style.touchAction = 'none';
    document.body.appendChild(boostButton);
    
    // Initialize joystick state
    this.joystick = {
      active: false,
      position: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 },
      container: {
        rect: joystickContainer.getBoundingClientRect(),
        radius: 60
      }
    };
    
    // Update joystick container rect on resize
    window.addEventListener('resize', () => {
      this.joystick.container.rect = joystickContainer.getBoundingClientRect();
    });
    
    // Handle rotation area events
    rotationArea.addEventListener('touchstart', (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      this.touchRotation.active = true;
      this.touchRotation.lastX = touch.clientX;
      this.touchRotation.lastY = touch.clientY;
    });
    
    rotationArea.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (this.touchRotation.active && this.playerSystem.localPlayer) {
        const touch = event.touches[0];
        const player = this.playerSystem.localPlayer;
        
        // Calculate delta movement
        const dx = touch.clientX - this.touchRotation.lastX;
        const dy = touch.clientY - this.touchRotation.lastY;
        
        // Apply rotation with sensitivity adjustment
        player.rotation.y -= dx * 0.005;
        
        // Limit vertical look
        const newPitch = player.rotation.x - dy * 0.005;
        player.rotation.x = THREE.MathUtils.clamp(
          newPitch, 
          -Math.PI / 3, // Increased range for better control
          Math.PI / 3
        );
        
        // Update last position
        this.touchRotation.lastX = touch.clientX;
        this.touchRotation.lastY = touch.clientY;
      }
    });
    
    rotationArea.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.touchRotation.active = false;
    });
    
    // Handle altitude button events
    altUpButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.touchAltitude.up = true;
    });
    
    altUpButton.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.touchAltitude.up = false;
    });
    
    altDownButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.touchAltitude.down = true;
    });
    
    altDownButton.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.touchAltitude.down = false;
    });
    
    // Handle fire button events
    fireButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.playerSystem.spells.castSpell();
    });
    
    // Handle boost button events
    boostButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.boosting = true;
    });
    
    boostButton.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.boosting = false;
    });
    
    this.setupJoystickEvents(input, joystick);
  }
  
  setupJoystickEvents(input, joystickElement) {
    // Handle touch events for joystick
    input.on('touchstart', (event) => {
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // Check if touch is within joystick container
        const containerRect = this.joystick.container.rect;
        if (
          touchX >= containerRect.left &&
          touchX <= containerRect.right &&
          touchY >= containerRect.top &&
          touchY <= containerRect.bottom
        ) {
          this.joystick.active = true;
          this.joystick.startPosition.x = touchX;
          this.joystick.startPosition.y = touchY;
          break;
        }
      }
    });
    
    input.on('touchmove', (event) => {
      if (this.joystick.active) {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          const touchX = touch.clientX;
          const touchY = touch.clientY;
          
          const containerRect = this.joystick.container.rect;
          const centerX = containerRect.left + containerRect.width / 2;
          const centerY = containerRect.top + containerRect.height / 2;
          
          // Calculate joystick position
          let dx = touchX - centerX;
          let dy = touchY - centerY;
          
          // Limit to container radius
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = this.joystick.container.radius;
          
          if (distance > maxDistance) {
            dx = dx * (maxDistance / distance);
            dy = dy * (maxDistance / distance);
          }
          
          // Update joystick position
          joystickElement.style.transform = `translate(${dx}px, ${dy}px)`;
          
          // Store normalized joystick position (-1 to 1)
          this.joystick.position.x = dx / maxDistance;
          this.joystick.position.y = dy / maxDistance;
          
          break;
        }
      }
    });
    
    input.on('touchend', (event) => {
      this.joystick.active = false;
      this.joystick.position.x = 0;
      this.joystick.position.y = 0;
      joystickElement.style.transform = 'translate(0px, 0px)';
    });
  }
}
