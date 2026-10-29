# Volve Solutions: Image Direction Pack

For any AI image tool (Grok, ChatGPT, Claude-driven pipelines). Read with `design/BRAND.md` section 8.

## The one rule that keeps posts premium

**AI makes the picture. The template makes the post.**

Image tools cannot be trusted with exact colours, fonts, logos or words. So:

1. Generate a **photo only**: no text, no logo, no phone number, no frame.
2. Drop it into a template spec (`design/templates/social/posts/*.json`, `"layout": "photo"`).
3. Render with `node design/templates/social/render.js <spec>`. The template adds the headline, lockup, Call Bar and the fade.

If you cannot run the renderer (for example inside a chat app), hand the image and the headline to someone who can. Do not bake text into the image.

## Aspect ratios to request

| Final post | Photo band shape | Ask the tool for |
|---|---|---|
| 4:5 feed post | Wide band | 16:9 landscape |
| 1:1 feed post | Very wide band | 16:9 landscape (it gets cropped top and bottom, keep the subject central) |
| 9:16 story | Near square band | 1:1 square |

Keep the subject in the middle 60% of the frame. The top and bottom 16% fade into espresso, so nothing important goes there.

## Master style block

Paste this at the end of every prompt, unchanged:

> Cinematic documentary photograph, Australia. Warm low-key lighting from a single warm source (golden hour, last light, or a desk lamp at night). Deep rich shadows falling to near-black warm brown. Colour grade: warm ochre and amber highlights, muted earth tones, no blue cast, no saturated orange. Shallow depth of field, 35mm lens, natural film grain, quiet and honest mood. Australian details only. No text, no words, no lettering, no logos, no watermarks anywhere in the image. No visible faces: people seen from behind, in silhouette, cropped at the neck, or hands only.

## Scene library

Each prompt = scene line + master style block.

1. **Kitchen table, 9pm.** Close-up of a tradie's weathered hands writing on a stack of invoices and quotes at a timber kitchen table at night, a stubby holder and a tape measure beside the papers, a laptop glowing at the edge of frame, a single desk lamp.
2. **Tailgate at last light.** A tradie in a hi-vis vest sits on the dropped tailgate of a white Australian ute in a suburban driveway at sunset, seen from behind, a pile of paperwork and a phone beside him on the tray, a brick veneer house with one lit window, a gum tree silhouette.
3. **Ute tub of unpaid work.** Inside the tub of a ute at golden hour: a cardboard box overflowing with paper invoices and envelopes, muddy steel-cap boots, a black plastic tool case, a takeaway coffee cup.
4. **Busy is not paid.** Overhead flat lay on a scarred timber bench in warm side light: a clipboard of job sheets, a claw hammer, a yellow tape measure, an open worn leather wallet holding two Australian gold dollar coins.
5. **Switchboard, end of day.** An Australian residential meter box on a brick wall at golden hour, door open, neat modern switchboard with labelled RCBOs, an electrician's gloved hand holding a multimeter probe, seen from behind the shoulder.
6. **Split system done.** A newly installed wall-mounted split system air conditioner in a quiet Australian living room at late afternoon, a technician's hands closing the front panel, warm window light across the wall.
7. **Phone in the dark cab.** Inside a ute cab at night, a tradie's hand holding a phone with a blurred bright screen, a clipboard on the passenger seat, dashboard glow, rain on the windscreen.
8. **Site shed table.** A site shed table at dusk with a hard hat, a folded set of plans, a stack of dockets held with a bulldog clip, and a phone face down, light from a single work light.
9. **Toolbag at the door.** A worn canvas tool bag and steel-cap boots left at the back door of a house at night, warm light spilling from inside the kitchen.
10. **Frame at sunset.** A timber house frame on a new estate at sunset, a builder seen from behind sitting on a stack of timber looking at a phone, a skip bin nearby, long warm shadows.

## Australian authenticity checklist (the sparky test)

Reject or regenerate if any of these are wrong:

- **Vehicles:** right-hand drive. Single or dual cab utes with steel trays or tubs (Hilux, Ranger, D-Max, Navara shapes). No American pickups, no US plates.
- **Money:** Australian coins only. Silver 5c, 10c, 20c, 50c (12-sided). Gold $1 and $2. No copper coins (gone since 1991). Notes are polymer.
- **Electrical:** Australian power points (angled flat pins, switch on the plate). Switchboards with modern RCBOs, labelled circuits, meter. Wiring colours red or brown active, black or blue neutral, green/yellow earth. No crammed European DIN rows full of mixed coloured wire.
- **Safety:** correct PPE for the task. No one working inside an open live board in shorts with a phone on the ground. Steel-cap boots, gloves where expected. Hi-vis is day/night orange or yellow with silver tape.
- **Homes and streets:** brick veneer, weatherboard, Colorbond roofs and fences, gum trees, wide nature strips. No basements, no snow, no US-style wooden fences and lawns.
- **No readable text** on paper, screens, vans or shirts. Blurred or angled away.
- **No faces** you could recognise. No stock smiles, thumbs up or handshakes.

## Grade and fix

| Problem | Fix in the prompt |
|---|---|
| Flat midday light | "golden hour, low sun from the side, long shadows" |
| Blue sky dominates | "sky mostly out of frame, warm dusk sky only" |
| Hi-vis or sunset too orange | "muted hi-vis, warm amber grade, desaturated orange" |
| Face visible | "seen from behind", "cropped at the neck", or "hands only" |
| Fake writing on paper | "papers blurred and out of focus, no legible text" |
| Too busy | cut to 2 or 3 objects, "minimal composition" |
| Plastic AI texture | "documentary photograph, natural film grain, real wear and dust" |

## Review before use

- [ ] Passes the authenticity checklist above.
- [ ] Single warm light source, shadows go to warm near-black.
- [ ] Subject sits in the middle 60%.
- [ ] No text, logos or faces.
- [ ] It tells one story that matches the headline.

Save approved images to `design/reference/images/` with a plain name (`ute-tailgate-sunset.jpg`) and reference them from the post spec.
