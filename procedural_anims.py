# Copyright (C) 2026 Stamatis Valis
# SPDX-License-Identifier: MIT
#
# Procedural generation of the bound-to-rot fighter clip set:
#   default_idle, default_walk, armed_idle, armed_walk,
#   armed_attack, special_select, special_death
#
# Poses are authored as world-space bone directions (see rig_map.Rig) so any
# rest pose / bone roll works. Motion beats follow the measured signatures of
# the reference fighter pack (see .ai/spec.md §5).
#
# Conventions (model at import rest, facing like characterMedium at yaw 0):
#   forward = -Y, character left = +X, up = +Z.

import math

import bpy

import rig_map

FIGHTER_CLIPS = [
    'default_idle',
    'default_walk',
    'armed_idle',
    'armed_walk',
    'armed_attack',
    'special_select',
    'special_death',
]

FWD = (0.0, -1.0, 0.0)
BACK = (0.0, 1.0, 0.0)
UP = (0.0, 0.0, 1.0)
DOWN = (0.0, 0.0, -1.0)
LEFT = (1.0, 0.0, 0.0)
RIGHT = (-1.0, 0.0, 0.0)


def _mix(first, *rest):
    """Weighted direction sum: _mix(dir, dir, w, dir, w, ...)."""
    x, y, z = first
    it = iter(rest)
    for d, w in zip(it, it):
        x += d[0] * w
        y += d[1] * w
        z += d[2] * w
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    return (x / n, y / n, z / n)


def _stance(rig, armed):
    """Relaxed standing pose; armed variant adds weapon-ready guard."""
    rig.aim('Hips', UP)
    rig.aim('Spine', _mix(UP, BACK, 0.05))
    rig.aim('Chest', _mix(UP, BACK, 0.06))
    rig.aim('Neck', _mix(UP, BACK, 0.04))
    rig.aim('Head', UP)
    rig.aim('LeftUpLeg', _mix(DOWN, LEFT, 0.07))
    rig.aim('RightUpLeg', _mix(DOWN, RIGHT, 0.07))
    rig.aim('LeftLeg', _mix(DOWN, LEFT, 0.05))
    rig.aim('RightLeg', _mix(DOWN, RIGHT, 0.05))
    rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
    rig.aim('RightFoot', _mix(FWD, DOWN, 0.55))
    rig.aim('LeftArm', _mix(DOWN, LEFT, 0.34, FWD, 0.06))
    rig.aim('LeftForeArm', _mix(DOWN, LEFT, 0.38, FWD, 0.2))
    rig.aim('LeftHand', _mix(DOWN, LEFT, 0.36, FWD, 0.24))
    if armed:
        rig.twist('Spine', -0.10)
        rig.twist('Chest', -0.13)
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.36, FWD, 0.16))
        rig.aim('RightForeArm', _mix(FWD, RIGHT, 0.16, DOWN, 0.5))
        rig.aim('RightHand', _mix(FWD, RIGHT, 0.15, DOWN, 0.45))
    else:
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.34, FWD, 0.06))
        rig.aim('RightForeArm', _mix(DOWN, RIGHT, 0.38, FWD, 0.2))
        rig.aim('RightHand', _mix(DOWN, RIGHT, 0.36, FWD, 0.24))


def _walk_frame(rig, height, i, armed):
    ph = 2.0 * math.pi * i / 8.0
    # thigh swing: cos so f0/f4 are the split (contact) frames and f2/f6
    # the passing frames - matches the reference bob (low at pass).
    s = math.cos(ph)
    # body high at contact, low at pass. BOTH knees flex at mid-stance
    # (real walk pattern) - that chain-shortening is what actually shrinks
    # the silhouette; a pure hip nudge just translates it.
    bob = math.cos(2.0 * ph)
    bend_base = (1.0 - bob) * 0.35
    bend_l = bend_base + max(0.0, math.sin(ph)) * 0.3
    bend_r = bend_base + max(0.0, -math.sin(ph)) * 0.3

    rig.aim('Hips', UP)
    rig.nudge('Hips', (0.0, 0.0, 0.05 * height * bob))
    rig.aim('Spine', _mix(UP, FWD, 0.07))
    rig.aim('Chest', _mix(UP, FWD, 0.06))
    rig.twist('Chest', 0.14 * s)
    rig.aim('Neck', UP)
    rig.aim('Head', _mix(UP, FWD, 0.03))

    rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.5 * s, LEFT, 0.07))
    rig.aim('RightUpLeg', _mix(DOWN, FWD, -0.5 * s, RIGHT, 0.07))
    rig.aim('LeftLeg', _mix(DOWN, FWD, 0.5 * s, BACK, 0.9 * bend_l, LEFT, 0.05))
    rig.aim('RightLeg', _mix(DOWN, FWD, -0.5 * s, BACK, 0.9 * bend_r, RIGHT, 0.05))
    rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55, UP, 0.3 * bend_l))
    rig.aim('RightFoot', _mix(FWD, DOWN, 0.55, UP, 0.3 * bend_r))

    rig.aim('LeftArm', _mix(DOWN, LEFT, 0.34, FWD, -0.45 * s))
    rig.aim('LeftForeArm', _mix(DOWN, LEFT, 0.36, FWD, -0.3 * s))
    rig.aim('LeftHand', _mix(DOWN, LEFT, 0.35, FWD, -0.26 * s))
    if armed:
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.36, FWD, 0.16 + 0.08 * s))
        rig.aim('RightForeArm', _mix(FWD, RIGHT, 0.16, DOWN, 0.5))
        rig.aim('RightHand', _mix(FWD, RIGHT, 0.15, DOWN, 0.45))
    else:
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.34, FWD, 0.5 * s))
        rig.aim('RightForeArm', _mix(DOWN, RIGHT, 0.36, FWD, 0.34 * s))
        rig.aim('RightHand', _mix(DOWN, RIGHT, 0.35, FWD, 0.3 * s))


def _attack_frame(rig, height, i):
    h = height
    if i == 0:
        _stance(rig, True)
        return
    if i == 1:
        # windup: body rises (hips up, tiptoes), weapon arm vertical
        # overhead with the shoulder lifted. On weaponless rigs the
        # silhouette top (hand/head) rises even if total height can't
        # exceed idle by 15% (the reference fighter's sword did that).
        rig.twist('Spine', -0.55)
        rig.twist('Chest', -0.40)
        rig.aim('Hips', UP)
        rig.nudge('Hips', (0.0, 0.02 * h, 0.12 * h))
        rig.aim('Spine', UP)
        rig.aim('Chest', UP)
        rig.aim('Neck', UP)
        rig.aim('Head', UP)
        rig.aim('RightShoulder', _mix(UP, RIGHT, 0.3))
        rig.aim('RightArm', UP)
        rig.aim('RightForeArm', UP)
        rig.aim('RightHand', _mix(UP, BACK, 0.1))
        rig.aim('LeftShoulder', _mix(UP, LEFT, 0.2, FWD, 0.15))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.55, FWD, 0.45))
        rig.aim('LeftForeArm', _mix(FWD, LEFT, 0.45, DOWN, 0.45))
        rig.aim('LeftHand', _mix(FWD, DOWN, 0.5))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.12, LEFT, 0.05))
        rig.aim('RightUpLeg', _mix(DOWN, BACK, 0.15, RIGHT, 0.05))
        rig.aim('LeftLeg', DOWN)
        rig.aim('RightLeg', DOWN)
        rig.aim('LeftFoot', _mix(DOWN, FWD, 0.15))
        rig.aim('RightFoot', _mix(DOWN, BACK, 0.15))
        return
    if i == 2:
        rig.twist('Spine', -0.18)
        rig.twist('Chest', -0.12)
        rig.aim('Hips', UP)
        rig.nudge('Hips', (0.0, 0.005 * h, -0.04 * h))
        rig.aim('Spine', _mix(UP, BACK, 0.06))
        rig.aim('Chest', _mix(UP, BACK, 0.05))
        rig.aim('Head', _mix(UP, FWD, 0.05))
        rig.aim('RightArm', _mix(UP, RIGHT, 0.3, FWD, 0.1))
        rig.aim('RightForeArm', _mix(UP, FWD, 0.25, RIGHT, 0.1))
        rig.aim('RightHand', _mix(UP, FWD, 0.4))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.35, FWD, 0.4))
        rig.aim('LeftForeArm', _mix(FWD, LEFT, 0.25, DOWN, 0.65))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.3, LEFT, 0.08))
        rig.aim('RightUpLeg', _mix(DOWN, BACK, 0.2, RIGHT, 0.08))
        rig.aim('LeftLeg', _mix(DOWN, FWD, 0.1, LEFT, 0.06))
        rig.aim('RightLeg', _mix(DOWN, BACK, 0.05, RIGHT, 0.06))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.6))
        return
    if i in (3, 4):
        deep = 1.0 if i == 3 else 1.1
        rig.twist('Spine', 0.50)
        rig.twist('Chest', 0.36)
        rig.aim('Hips', UP)
        rig.nudge('Hips', (0.0, -0.01 * h, -0.075 * h * deep))
        rig.aim('Spine', _mix(DOWN, FWD, 0.85))
        rig.aim('Chest', _mix(DOWN, FWD, 0.9))
        rig.aim('Neck', _mix(DOWN, FWD, 0.5))
        rig.aim('Head', _mix(DOWN, FWD, 0.55))
        rig.aim('RightArm', _mix(DOWN, FWD, 0.75, RIGHT, 0.35))
        rig.aim('RightForeArm', _mix(DOWN, FWD, 0.9, RIGHT, 0.2))
        rig.aim('RightHand', _mix(DOWN, FWD, 0.95, RIGHT, 0.15))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.4, FWD, 0.5))
        rig.aim('LeftForeArm', _mix(DOWN, FWD, 0.6, LEFT, 0.3))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.25, LEFT, 0.12))
        rig.aim('RightUpLeg', _mix(DOWN, FWD, 0.15, RIGHT, 0.12))
        rig.aim('LeftLeg', _mix(DOWN, BACK, 0.2, LEFT, 0.1))
        rig.aim('RightLeg', _mix(DOWN, BACK, 0.25, RIGHT, 0.1))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.6))
        return
    if i == 5:
        rig.twist('Spine', 0.26)
        rig.twist('Chest', 0.18)
        rig.aim('Hips', UP)
        rig.nudge('Hips', (0.0, 0.0, -0.03 * h))
        rig.aim('Spine', _mix(UP, FWD, 0.3))
        rig.aim('Chest', _mix(UP, FWD, 0.28))
        rig.aim('Head', _mix(UP, FWD, 0.15))
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.4, FWD, 0.4))
        rig.aim('RightForeArm', _mix(DOWN, FWD, 0.6, RIGHT, 0.3))
        rig.aim('RightHand', _mix(DOWN, FWD, 0.7))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.35, FWD, 0.25))
        rig.aim('LeftForeArm', _mix(DOWN, LEFT, 0.38, FWD, 0.2))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.2, LEFT, 0.09))
        rig.aim('RightUpLeg', _mix(DOWN, FWD, 0.1, RIGHT, 0.09))
        rig.aim('LeftLeg', _mix(DOWN, FWD, 0.05, LEFT, 0.06))
        rig.aim('RightLeg', _mix(DOWN, FWD, 0.05, RIGHT, 0.06))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.55))
        return
    if i == 6:
        rig.twist('Spine', 0.14)
        rig.twist('Chest', 0.10)
        rig.aim('Hips', UP)
        rig.nudge('Hips', (0.0, 0.0, -0.015 * h))
        rig.aim('Spine', _mix(UP, FWD, 0.12))
        rig.aim('Chest', _mix(UP, FWD, 0.1))
        rig.aim('Head', UP)
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.38, FWD, 0.25))
        rig.aim('RightForeArm', _mix(DOWN, FWD, 0.5, RIGHT, 0.25))
        rig.aim('RightHand', _mix(DOWN, FWD, 0.55))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.34, FWD, 0.12))
        rig.aim('LeftForeArm', _mix(DOWN, LEFT, 0.38, FWD, 0.2))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.1, LEFT, 0.08))
        rig.aim('RightUpLeg', _mix(DOWN, FWD, 0.05, RIGHT, 0.08))
        rig.aim('LeftLeg', _mix(DOWN, LEFT, 0.05))
        rig.aim('RightLeg', _mix(DOWN, RIGHT, 0.05))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.55))
        return
    _stance(rig, True)


def _select_frame(rig, height, i):
    _stance(rig, True)
    t = (1.0 - math.cos(2.0 * math.pi * i / 8.0)) * 0.5
    rig.nudge('Hips', (0.0, 0.0, 0.014 * height * t))


def _death_frame(rig, height, i):
    h = height
    if i == 0:
        _stance(rig, True)
        return
    if i in (1, 2):
        k = i
        rig.aim('Hips', UP)
        rig.nudge('Hips', (0.0, 0.01 * h * k, -0.012 * h * k))
        rig.aim('Spine', _mix(UP, BACK, 0.22 * k))
        rig.aim('Chest', _mix(UP, BACK, 0.18 * k))
        rig.aim('Head', _mix(UP, BACK, 0.3 * k))
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.3, UP, 0.25 * k, BACK, 0.3 * k))
        rig.aim('RightForeArm', _mix(FWD, RIGHT, 0.2, UP, 0.3 * k))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.3, UP, 0.4 * k, FWD, 0.3 * k))
        rig.aim('LeftForeArm', _mix(UP, LEFT, 0.3, FWD, 0.4))
        buckled = 0.35 * k
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.15, LEFT, 0.08))
        rig.aim('LeftLeg', _mix(DOWN, FWD, buckled, LEFT, 0.06))
        rig.aim('RightUpLeg', _mix(DOWN, RIGHT, 0.08))
        rig.aim('RightLeg', _mix(DOWN, BACK, 0.1, RIGHT, 0.06))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.6))
        return
    if i == 3:
        rig.aim('Hips', _mix(UP, FWD, 0.25))
        rig.nudge('Hips', (0.0, -0.02 * h, -0.07 * h))
        rig.aim('Spine', _mix(UP, FWD, 0.45))
        rig.aim('Chest', _mix(UP, FWD, 0.5))
        rig.aim('Head', _mix(UP, FWD, 0.35))
        rig.aim('RightArm', _mix(DOWN, RIGHT, 0.5, FWD, 0.4))
        rig.aim('RightForeArm', _mix(FWD, RIGHT, 0.3, DOWN, 0.4))
        rig.aim('LeftArm', _mix(DOWN, LEFT, 0.5, FWD, 0.5))
        rig.aim('LeftForeArm', _mix(FWD, LEFT, 0.3, DOWN, 0.4))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.3, LEFT, 0.1))
        rig.aim('RightUpLeg', _mix(DOWN, FWD, 0.2, RIGHT, 0.1))
        rig.aim('LeftLeg', _mix(DOWN, BACK, 0.35, LEFT, 0.08))
        rig.aim('RightLeg', _mix(DOWN, BACK, 0.3, RIGHT, 0.08))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.55))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.6))
        return
    if i == 4:
        rig.aim('Hips', _mix(UP, FWD, 0.4))
        rig.nudge('Hips', (0.0, -0.05 * h, -0.17 * h))
        rig.aim('Spine', _mix(UP, FWD, 0.75))
        rig.aim('Chest', _mix(UP, FWD, 0.8))
        rig.aim('Head', _mix(UP, FWD, 0.6))
        rig.aim('RightArm', _mix(UP, RIGHT, 0.6, FWD, 0.3))
        rig.aim('RightForeArm', _mix(UP, FWD, 0.5, RIGHT, 0.3))
        rig.aim('LeftArm', _mix(UP, LEFT, 0.6, FWD, 0.3))
        rig.aim('LeftForeArm', _mix(UP, FWD, 0.5, LEFT, 0.3))
        rig.aim('LeftUpLeg', _mix(DOWN, FWD, 0.35, LEFT, 0.12))
        rig.aim('RightUpLeg', _mix(DOWN, FWD, 0.25, RIGHT, 0.12))
        rig.aim('LeftLeg', _mix(DOWN, BACK, 0.5, LEFT, 0.1))
        rig.aim('RightLeg', _mix(DOWN, BACK, 0.45, RIGHT, 0.1))
        rig.aim('LeftFoot', _mix(FWD, DOWN, 0.4))
        rig.aim('RightFoot', _mix(FWD, DOWN, 0.4))
        return
    if i in (5, 6, 7):
        drop = {5: 0.30, 6: 0.36, 7: 0.37}[i]
        curl = {5: 0.0, 6: 0.5, 7: 1.0}[i]
        rig.aim('Hips', _mix(FWD, DOWN, 2.0))
        rig.nudge('Hips', (0.0, -0.05 * h, -drop * h))
        rig.aim('Spine', _mix(FWD, DOWN, 0.45 - 0.25 * curl))
        rig.aim('Chest', _mix(FWD, DOWN, 0.3 - 0.15 * curl))
        rig.aim('Head', _mix(DOWN, FWD, 0.4, DOWN, 0.6 * curl))
        rig.aim('RightArm', _mix(FWD, DOWN, 1.1, RIGHT, 0.55 - 0.25 * curl))
        rig.aim('RightForeArm', _mix(DOWN, FWD, 0.5 + 0.5 * curl, RIGHT, 0.35))
        rig.aim('LeftArm', _mix(FWD, DOWN, 1.2, LEFT, 0.6 - 0.3 * curl))
        rig.aim('LeftForeArm', _mix(DOWN, FWD, 0.55 + 0.45 * curl, LEFT, 0.35))
        # knees fold forward under the body (compact heap, not sprawled)
        rig.aim('LeftUpLeg', _mix(FWD, DOWN, 1.3 - 0.5 * curl, LEFT, 0.15))
        rig.aim('RightUpLeg', _mix(FWD, DOWN, 1.1 - 0.4 * curl, RIGHT, 0.15))
        rig.aim('LeftLeg', _mix(BACK, DOWN, 0.7, FWD, 0.6 * curl, LEFT, 0.1))
        rig.aim('RightLeg', _mix(BACK, DOWN, 0.6, FWD, 0.55 * curl, RIGHT, 0.1))
        rig.aim('LeftFoot', _mix(BACK, DOWN, 0.5, FWD, 0.4))
        rig.aim('RightFoot', _mix(BACK, DOWN, 0.45, FWD, 0.45))
        return


def _finish(arm_obj, clip):
    ad = arm_obj.animation_data
    act = ad.action if ad else None
    if act is None:
        raise RuntimeError('no action generated for clip %s' % clip)
    act.name = clip
    act.use_fake_user = True
    try:
        ad.action = None
        if getattr(ad, 'action_slot', None) is not None:
            ad.action_slot = None
    except Exception:
        pass
    return act


def generate_all(arm_obj, mapping):
    """Generate the 7 fighter clips on arm_obj. Returns clip names in order."""
    rig = rig_map.Rig(arm_obj, mapping)
    height = rig.height()
    arm_obj.animation_data_create()
    made = []
    for clip in FIGHTER_CLIPS:
        frames = 1 if clip.endswith('idle') else 8
        for i in range(frames):
            rig.clear()
            if clip == 'default_idle':
                _stance(rig, False)
            elif clip == 'armed_idle':
                _stance(rig, True)
            elif clip == 'default_walk':
                _walk_frame(rig, height, i, False)
            elif clip == 'armed_walk':
                _walk_frame(rig, height, i, True)
            elif clip == 'armed_attack':
                _attack_frame(rig, height, i)
            elif clip == 'special_select':
                _select_frame(rig, height, i)
            elif clip == 'special_death':
                _death_frame(rig, height, i)
            rig.key(i)
        _finish(arm_obj, clip)
        made.append(clip)
        print('[anim] generated %s (%d frame%s)'
              % (clip, frames, '' if frames == 1 else 's'))
    rig.clear()
    bpy.context.view_layer.update()
    return made
