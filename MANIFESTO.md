# PDF
There's the final report. You are to make sure everything wraps instead of overflowing. Because there's no scrollbar on paper.
# Video demos
The fact is that the video demos leave much to be desired. Interactions are often subtly broken, and too much time is devoted to logging in as the demo switches between users.

The video demos ought to be revised significantly while still keeping their intended interaction scenarios. In service of this goal, we:
* Interact with Puppeteer through Node.js REPL, while still keeping records of the individual commands in temporary files
* When we are done interacting, from our interaction records, we then construct screencast generation scripts
* Keep in mind:
  * Sometimes we need separate browser instances for different users simultaneously interacting
  * When the process of interacting uncovers bugs, you are to fix the bugs
* You have to run the entire Docker Compose solution in order to interact with the app. I do not accept half measures.
