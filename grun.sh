#!/bin/bash
git fetch
git pull --rebase
clear
echo 'Project ready!'
node app.js