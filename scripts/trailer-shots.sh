#!/usr/bin/env bash
#
# The opening, and how much of each generated clip it uses.
#
# Two scripts need this and they must not disagree: make-trailer.sh builds
# the store trailer, make-intro.sh builds the clip that plays the first time
# the game is opened. They are the same eight seconds of film.
#
# ═══ WHY THE NUMBERS ARE SMALL ═══
#
# Each clip in assets/raw/trailer/clips is five seconds, and each of these
# takes between 1.1 and 1.8 of them FROM THE HEAD. Kling drifts towards the
# end of a clip — at 4.6 seconds something falls on the fried bread out of
# nowhere, and the colossus used to sprout horns by second four. The head of
# a clip still looks like the frame that was approved.
#
# 06-charge holds for all five now, because the creatures run AT the camera
# and the only thing the model can do with that is make them bigger. It is
# still cut at 1.6 to stay in rhythm with the shots around it.
#
# 08-fold is not here. Or: "they walk to Amanda and it ends there with a fade
# to the game." The opening peaks when she rises and a dissolve after it is a
# second ending.
SHOTS=(
  "01-pump 1.2" "02-titan 1.4" "03-dragon 1.4" "04-chuppy 1.3"
  "05-bread 1.1" "06-charge 1.6" "07-amanda 1.8"
)
