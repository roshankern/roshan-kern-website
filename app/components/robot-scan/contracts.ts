/** Millimetres, +Y up, tabletop Y=0. The subject faces +Z toward the robot. */
export type Vec3 = { x: number; y: number; z: number };
export type ScanSample = { skin: Vec3; normal: Vec3 };
export type ArmJoints = {
  pan: number; lift: number; elbow: number; flex: number; roll: number;
  reachable: boolean;
};

/** Reference centre for the raster; measured scan geometry supplies its depth. */
export const HEAD = { centre: { x: 0, y: 190, z: -190 } } as const;

/** URDF-derived pivots and limits in the renderer's convention.
 * See hardware-reference.md. The gripper is replaced by the optical head. */
export const ARM = {
  baseZ: 195,
  shoulderY: 119,
  L1: 116,
  L2: 135,
  L3: 63.7,
  limits: {
    pan: [-1.91986, 1.91986],
    lift: [-0.42, 3.07],
    elbow: [-3.086, 0.293],
    flex: [-1.65806, 1.65806],
    roll: [-2.74385, 2.84121],
  },
} as const;

/** Neutral carrier pose used by IK; faceTrajectory adds clearance and swivel yaw. */
export const MOUNT = {
  standoff: 50,
  axisTilt: 0,
  lensFromAxis: 0,
  lensAlongLink: 44,
  bracketRoll: 0,
} as const;

export function rollOriginFor(sample: ScanSample, linkDir: Vec3): Vec3 {
  return {
    x: sample.skin.x + sample.normal.x * MOUNT.standoff - linkDir.x * MOUNT.lensAlongLink,
    y: sample.skin.y + sample.normal.y * MOUNT.standoff - linkDir.y * MOUNT.lensAlongLink,
    z: sample.skin.z + sample.normal.z * MOUNT.standoff - linkDir.z * MOUNT.lensAlongLink,
  };
}
