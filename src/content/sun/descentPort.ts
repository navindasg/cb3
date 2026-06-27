// The photosphere descent port (Act 4 — quest 11, DESIGN §5/§194/§196). Pure flavor config the finale
// screen reads. The descent hatch on the scaffold opens onto nothing but light; below the photosphere
// something has kept the star burning all along, and the bathysphere is the one thing that can ride down
// to it. This slice stands up the descent-PORT landing beat + the descent button label; the descent SIM
// and the resource gate are wired in a later slice (the button stays disabled until then).
//
// The aesthetic weight of this beat is the SILENCE about to break: after ~18 hours in which nothing in the
// game has ever made a sound, pressing the descent button is the moment the game's one cue plays. The voice
// here is terse, tired, and dreading the down — no exclamation, no triumph. Pure ASCII, no glyphs. §22-open.

/** The descent-port landing blurb — the hatch open onto light, the bathysphere ready, the down waiting. */
export const DESCENT_PORT_BLURB =
  'The bathysphere hangs cold and sealed over the open hatch, and past it there is no dark to descend into — only the photosphere, a floor of slow white fire with no bottom you can see. The works-master does not come out onto the gantry with you. "I have caged it. I am not going to go and look at what is under it." You check the seals one more time. There is nothing left to build. There is only down.'

/**
 * The descent button label — the act of beginning the descent. Pressing it is the instant the cue fires
 * (the descent-button click is the user gesture the render glue lazy-constructs its AudioContext inside).
 */
export const DESCENT_BUTTON_LABEL = 'lower the bathysphere into the photosphere'

/**
 * The not-ready note — shown when the descent port is reachable (the Act-3 gate is cleared) but the
 * resource gate is not yet met (wired in a later slice). Keeps the dread without a dead button.
 */
export const DESCENT_NOT_READY_NOTE =
  'Not yet. The vessel wants more cold packed into it before it will hold against a star — coolant and plating, banked, before the seals are trusted.'

/**
 * The shut note — a defensive landing if the screen is reached before the Act-3 gate is cleared. Answers in
 * voice, never a blank screen (the scaffoldScreens defensive idiom).
 */
export const DESCENT_PORT_SHUT_BLURB =
  'The scaffold is not finished and the bathysphere is not sealed. The hatch onto the photosphere stays shut. Close the cage and build the vessel first.'
