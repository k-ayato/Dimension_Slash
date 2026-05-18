import Phaser from 'phaser';
import { CardLoader } from './utils/CardLoader.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { RuleScene } from './scenes/RuleScene.js';

async function bootstrap() {
  await CardLoader.load();

  new Phaser.Game({
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#0a0a1a',
    scene: [TitleScene, GameScene, ResultScene, RuleScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    parent: document.body,
  });
}

bootstrap();
