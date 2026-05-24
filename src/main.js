import Phaser from 'phaser';
import { CardLoader } from './utils/CardLoader.js';
import { TitleScene } from './scenes/TitleScene.js';
import { TutorialScene } from './scenes/TutorialScene.js';
import { CoinScene } from './scenes/CoinScene.js';
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
    scene: [TitleScene, TutorialScene, CoinScene, GameScene, ResultScene, RuleScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    parent: document.body,
  });
}

bootstrap();
