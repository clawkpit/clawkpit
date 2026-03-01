# Clawkpit Demo Script

This folder contains a bash script that populates Clawkpit with a paced, realistic solo-founder workflow for screen recording.

## Run

Start the Clawkpit API locally, then run:

```bash
cd ~/clawkpit/demo
./run-demo.sh YOUR_API_KEY
```

The script uses `CLAWKPIT_BASE_URL` when set. Otherwise it targets `http://localhost:5137`.

Example:

```bash
CLAWKPIT_BASE_URL=http://localhost:5137 ./run-demo.sh ck_live_your_api_key
```

## Record

For the cleanest demo:

1. Open the Clawkpit board in the browser and start your screen recording.
2. Keep the board visible while the script runs so new items, notes, and urgency shifts arrive progressively.
3. Click into the form item and markdown item during the run if you want the structured content to be visible in the recording.
4. Leave enough time for the full sequence to complete. The script runs for about 110 seconds.

## Expected Outcome

Running the script will:

- create 15 realistic items for a solo founder app called OrbitMint
- add one structured partnership intake form
- add one markdown article with more than 40 lines
- simulate human plus AI collaboration with three notes
- shift urgency on six items as priorities change
- pace every action with sleeps so the board evolves naturally on screen
