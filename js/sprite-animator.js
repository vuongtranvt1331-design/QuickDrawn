/* Individual PNGs: 40 columns x 3 rows, fixed 128x128 cells with >=16px padding.
 * Row 0: idle (40 frames / 2800ms); rows 1/2: shoot/hit (8 frames / 500ms).
 * All source sprites face right. CSS mirrors only the enemy canvas container.
 */
class CowboyAnimator {
  static ANIMATIONS = Object.freeze({
    idle: Object.freeze({ row: 0, frames: 40, duration: 2800, loop: true }),
    shoot: Object.freeze({ row: 1, frames: 8, duration: 500, loop: false }),
    hit: Object.freeze({ row: 2, frames: 8, duration: 500, loop: false })
  });

  constructor(canvasElement, isPlayer = true) {
    if (!canvasElement) throw new Error('Missing character canvas');
    this.canvas = canvasElement;
    this.canvas.width = this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.spriteSheet = new Image();
    this.isLoaded = false;
    this.isPlayer = isPlayer;
    this.frameWidth = this.frameHeight = 128;
    this.currentAnim = 'idle';
    this.currentFrame = 0;
    this.totalFrames = 40;
    this.animStartTime = performance.now();
    this.animDuration = 2800;
    this.isLooping = true;
    this.rafId = null;
    this.lastDrawn = '';
  }

  load(src) {
    return new Promise((resolve, reject) => {
      this.spriteSheet.onload = () => {
        if (this.spriteSheet.naturalWidth !== 40 * this.frameWidth ||
            this.spriteSheet.naturalHeight !== 3 * this.frameHeight) {
          reject(new Error('Cowboy atlas must be 5120x384 pixels'));
          return;
        }
        this.canvas.setAttribute('data-sprite-src', src);
        this.isLoaded = true;
        resolve();
      };
      this.spriteSheet.onerror = () => reject(new Error('Could not load cowboy sprite: ' + src));
      this.spriteSheet.src = src;
    });
  }

  setAnimation(animName, startedAt = performance.now()) {
    if (!Object.hasOwn(CowboyAnimator.ANIMATIONS, animName)) throw new Error('Unknown cowboy animation');
    const animation = CowboyAnimator.ANIMATIONS[animName];
    this.currentAnim = animName;
    this.currentFrame = 0;
    this.animStartTime = startedAt;
    this.totalFrames = animation.frames;
    this.animDuration = animation.duration;
    this.isLooping = animation.loop;
    this.lastDrawn = '';
    this.canvas.setAttribute('data-animation', animName);
    this.start();
  }

  start() {
    this.stop();
    // The load caller starts rendering on success; no endless RAF loop on a missing image.
    if (!this.isLoaded) return;
    const render = now => {
      const elapsed = Math.max(0, now - this.animStartTime);
      const position = this.isLooping ? elapsed % this.animDuration : Math.min(elapsed, this.animDuration);
      this.currentFrame = Math.min(this.totalFrames - 1,
        Math.floor(position / (this.animDuration / this.totalFrames)));
      this.draw();
      if (this.isLooping || elapsed < this.animDuration) this.rafId = requestAnimationFrame(render);
      else this.rafId = null; // Hold the last bitmap until a new animation is selected.
    };
    render(performance.now());
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  draw() {
    if (!this.isLoaded) return;
    const key = this.currentAnim + ':' + this.currentFrame;
    if (key === this.lastDrawn) return;
    const rowIndex = CowboyAnimator.ANIMATIONS[this.currentAnim].row;
    const frame = Math.max(0, Math.min(this.totalFrames - 1, Math.floor(this.currentFrame)));
    const sx = Math.floor(frame * this.frameWidth);
    const sy = Math.floor(rowIndex * this.frameHeight);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.spriteSheet, sx, sy, this.frameWidth, this.frameHeight,
      0, 0, this.canvas.width, this.canvas.height);
    this.lastDrawn = key;
    this.canvas.setAttribute('data-frame', String(this.currentFrame));
  }
}

// Keep the existing game's setState API: all scoring, question and timeout code stays intact.
class SpriteAnimator {
  constructor(stage, playerAnimator, enemyAnimator) {
    if (!playerAnimator || !enemyAnimator || playerAnimator.canvas === enemyAnimator.canvas) {
      throw new Error('The duel requires two independent character canvases');
    }
    this.stage = stage;
    this.state = 'state-idle';
    this.playerAnimator = playerAnimator;
    this.enemyAnimator = enemyAnimator;
    this.setState('state-idle');
  }

  get ready() { return this.playerAnimator.isLoaded && this.enemyAnimator.isLoaded; }

  get frame() { return this.playerAnimator.currentFrame; }

  setState(nextState) {
    const states = {
      'state-idle': ['idle', 'idle', 'Two cowboys facing off in the desert'],
      'state-player-win': ['shoot', 'hit', 'Player fires; enemy falls over'],
      'state-enemy-win': ['hit', 'shoot', 'Enemy fires; player falls over']
    };
    if (!Object.hasOwn(states, nextState)) throw new Error('Unknown duel state');
    const [player, enemy, description] = states[nextState];
    const startedAt = performance.now(); // Both canvases use the same clock origin.
    this.state = nextState;
    this.stage.className = 'duel-stage ' + nextState;
    this.stage.setAttribute('aria-label', description);
    this.playerAnimator.setAnimation(player, startedAt);
    this.enemyAnimator.setAnimation(enemy, startedAt);
  }
}

function triggerPlayerWinState() { duelAnimator.setState('state-player-win'); }
function triggerEnemyWinState() { duelAnimator.setState('state-enemy-win'); }
