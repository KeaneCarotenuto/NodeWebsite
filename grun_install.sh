#!/bin/bash

echo """#!/bin/bash
git pull
clear
echo 'Project ready!'
node $1
""" >> grun.sh
chmod +x grun.sh
echo "alias grun='./grun.sh'" >> ~/.bashrc