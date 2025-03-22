export class InputManager {
  constructor() {
    this.keys = {};
    this.touches = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 };
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.listeners = {};
    this.pointerLocked = false;
    this.pointerLockSupported = 'pointerLockElement' in document;
    this.pointerLockEnabled = false; // Default to disabled until we verify it's safe
    
    // Debug flag to log key events
    this.debugInput = false;
    
    // Immediately check if we're in a sandboxed environment
    this.detectSandboxEnvironment();
  }
  
  // Detect if we're in a sandboxed environment that doesn't allow pointer lock
  detectSandboxEnvironment() {
    try {
      // Check if we're in an iframe
      const isInIframe = window !== window.top;
      
      // Try a test pointer lock request to see if it's allowed
      const testPointerLock = () => {
        try {
          // Create a temporary element for testing
          const testElement = document.createElement('div');
          document.body.appendChild(testElement);
          
          // Try to request pointer lock (this will fail in sandboxed environments)
          testElement.requestPointerLock();
          
          // If we get here, it might be allowed (though the actual lock won't happen without user interaction)
          document.body.removeChild(testElement);
          return true;
        } catch (e) {
          // If we get an error, pointer lock is definitely not allowed
          console.warn('Pointer lock test failed:', e.message);
          return false;
        }
      };
      
      // Only enable pointer lock if we're not in an iframe or if the test passes
      this.pointerLockEnabled = !isInIframe && this.pointerLockSupported;
      
      console.log(`Pointer lock ${this.pointerLockEnabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      // If any error occurs during detection, disable pointer lock to be safe
      this.pointerLockEnabled = false;
      console.warn('Error during sandbox detection, disabling pointer lock:', e.message);
    }
  }
  
  initialize() {
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // Mouse events
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Pointer lock for camera control - only if supported and enabled
    if (this.pointerLockSupported && this.pointerLockEnabled) {
      document.addEventListener('click', this.requestPointerLock.bind(this));
      document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
      document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
      console.log('Pointer lock event listeners added');
    } else {
      console.log('Using alternative mouse controls (pointer lock disabled)');
    }
    
    // Touch events for mobile
    if (this.isTouchDevice) {
      window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
      window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    }
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Log initialization
    console.log('Input manager initialized');
  }
  
  // Input event handlers
  onKeyDown(event) {
    if (this.debugInput) {
      console.log(`Key down: ${event.code}`);
    }
    
    this.keys[event.code] = true;
    this.emit('keydown', event);
  }
  
  onKeyUp(event) {
    if (this.debugInput) {
      console.log(`Key up: ${event.code}`);
    }
    
    this.keys[event.code] = false;
    this.emit('keyup', event);
  }
  
  onMouseDown(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mousedown', event);
  }
  
  onMouseUp(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mouseup', event);
  }
  
  onMouseMove(event) {
    if (this.pointerLocked) {
      // Use movementX/Y for more accurate mouse control when pointer is locked
      this.mouse.dx = event.movementX || 0;
      this.mouse.dy = event.movementY || 0;
    } else {
      const prevX = this.mouse.x;
      const prevY = this.mouse.y;
      
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
      this.mouse.dx = this.mouse.x - prevX;
      this.mouse.dy = this.mouse.y - prevY;
    }
    
    this.emit('mousemove', event);
  }
  
  onTouchStart(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches[touch.identifier] = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY
      };
    }
    
    this.emit('touchstart', event);
  }
  
  onTouchEnd(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      delete this.touches[touch.identifier];
    }
    
    this.emit('touchend', event);
  }
  
  onTouchMove(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (this.touches[touch.identifier]) {
        this.touches[touch.identifier].x = touch.clientX;
        this.touches[touch.identifier].y = touch.clientY;
      }
    }
    
    this.emit('touchmove', event);
  }
  
  // Event system
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(data);
      }
    }
  }
  
  // Helper methods
  isKeyDown(keyCode) {
    // Debug log for key checks if enabled
    if (this.debugInput && keyCode === 'KeyW') {
      console.log(`Checking KeyW: ${!!this.keys[keyCode]}`);
    }
    
    return !!this.keys[keyCode];
  }
  
  getTouchCount() {
    return Object.keys(this.touches).length;
  }
  
  requestPointerLock() {
    // Skip pointer lock request entirely if it's not enabled
    if (!this.pointerLockEnabled) {
      console.log('Pointer lock disabled - skipping request');
      return;
    }
    
    if (!this.pointerLocked && this.pointerLockSupported) {
      try {
        // Use a try-catch to handle any potential errors
        document.body.requestPointerLock();
        console.log('Pointer lock requested');
      } catch (error) {
        // If there's an error, disable pointer lock for future attempts
        console.error('Pointer lock request failed:', error.message);
        this.pointerLockEnabled = false;
        this.emit('pointerlock', false);
      }
    }
  }
  
  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === document.body;
    console.log('Pointer lock state changed:', this.pointerLocked);
    this.emit('pointerlock', this.pointerLocked);
  }
  
  onPointerLockError() {
    console.error('Pointer lock error occurred - disabling pointer lock');
    this.pointerLockEnabled = false;
    this.emit('pointerlockerror');
  }
}
