import type {Check} from './harness';
import {checks as growth} from './growth.check';import {checks as warp} from './warp.check';import {checks as fx} from './fx.check';
import {checks as engine} from './engine.check';import {checks as tracker} from './tracker.check';
import {checks as bones} from './bones.check';import {checks as airway} from './airway.check';import {checks as digestive} from './digestive.check';
import {checks as eyesTeeth} from './eyes-teeth.check';import {checks as skin} from './skin.check';import {checks as systemic} from './systemic.check';
import {checks as clipping} from './clipping.check';import {checks as integration} from './integration.check';import {checks as ghost} from './ghost.check';
export const ALL:Record<string,Check[]>={growth,warp,fx,engine,tracker,bones,airway,digestive,eyesTeeth,skin,systemic,clipping,integration,ghost};
