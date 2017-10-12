# AI-maze_me

This is a course project made at Linköping University for the course TNM095 - AI for Interactive Media.

It's a randomly generated maze consisting of brick walls and non-solid (but opaque) bushes. Solve the maze before your energy drains! 
* -1 for a ordinary step
* -5 to go through a bush

### Playing modes

Choose mode with the following
* P - Manual Player mode
* A - AI mode
* V - Versus mode

##### Manual Player mode
Use the arrow keys to find your way out from the labyrinth before your energy drains!

Controls
* I - Show Information
* H - Show Help

##### AI mode
Watch a trained AI solve the randomized mazes!
The agent has been trained with Reinforcement learning (Q-learning) to be able to solve these generic kinds of mazes.

Controls:
* +/- - Speed up/down the game/training
* C - Continue the training 
* N - Start training a new agent
* S - Download a file with current agents
* R - Restart level
* M - Show a map over the entire maze and where the AI has moved

##### Versus mode
Play against an AI agent. Find the exit first. Best score after 10 rounds wins!
Try to beat the AI without cheating!