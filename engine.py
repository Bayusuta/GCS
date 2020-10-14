#!/usr/bin/env python

from dronekit import connect, VehicleMode, LocationGlobalRelative
from pymavlink import mavutil
from queue import Queue
from flask import Flask, render_template, jsonify, Response, request, redirect, url_for
import time
import json
import urllib
import atexit
import os
import sys
import socket
from threading import Thread
from subprocess import Popen
from flask import render_template
from flask import Flask, Response
from datetime import datetime

import dronekit_sitl as sim
sitl                = sim.start_default()
connection_string   = sitl.connection_string()

vehicles = {}
vehicle = None

vehicle_dataList = []
vehicle_AvailableOverlayList = [] # Wahana yang sudah punya overlay

# Allow us to reuse sockets after the are bound.
# http://stackoverflow.com/questions/25535975/release-python-flask-port-when-script-is-terminated
socket.socket._bind = socket.socket.bind
def my_socket_bind(self, *args, **kwargs):
    self.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    return socket.socket._bind(self, *args, **kwargs)
socket.socket.bind = my_socket_bind

def sse_encode(obj, id=None):
    return "data: %s\n\n" % json.dumps(obj)

def state_msg(id):
    if vehicles.get(id).location.global_relative_frame.lat == None:
        raise Exception('no position info')
    if vehicles.get(id).armed == None:
        raise Exception('no armed info')
    return {
        "id": vehicles.get(id).id,
        "armed": vehicles.get(id).armed,
        "alt": vehicles.get(id).location.global_relative_frame.alt,
        "mode": vehicles.get(id).mode.name,
        "heading": vehicles.get(id).heading or 0,
        "vspeed":vehicles.get(id).airspeed,
        "gspeed":vehicles.get(id).groundspeed,
        "lat": vehicles.get(id).location.global_relative_frame.lat,
        "lon": vehicles.get(id).location.global_relative_frame.lon
    }

def arm_and_takeoff(aTargetAltitude, id):
    """
    Arms vehicle and fly to aTargetAltitude.
    """

    print("Basic pre-arm checks")
    # Don't try to arm until autopilot is ready
    while not vehicles[id].is_armable:
        print(" Waiting for vehicle to initialise...")
        time.sleep(1)

    print("Arming motors")
    # Copter should arm in GUIDED mode
    vehicles.get(id).mode = VehicleMode("GUIDED")
    vehicles.get(id).armed = True

    # Confirm vehicle armed before attempting to take off
    while not vehicles.get(id).armed:
        print(" Waiting for arming...")
        time.sleep(1)

    print("Taking off!")
    vehicles.get(id).simple_takeoff(aTargetAltitude)  # Take off to target altitude

    # Wait until the vehicle reaches a safe height before processing the goto
    #  (otherwise the command after Vehicle.simple_takeoff will execute
    #   immediately).
    while True:
        print(" Altitude: ", vehicles.get(id).location.global_relative_frame.alt)
        # Break and return from function just below target altitude.
        if vehicles.get(id).location.global_relative_frame.alt >= aTargetAltitude * 0.95:
            print("Reached target altitude")
            break
        time.sleep(1)


app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False

@app.route("/")
def index():
    return redirect(url_for('status'))

@app.route("/status")
def status():
    return render_template('status.html', branding=False)

@app.route("/plan")
def plan():
    return render_template('plan.html', branding=False)

@app.route("/plan2")
def plan2():
    return render_template('plan2.html', branding=False)

@app.route("/marker-overlay")
def marker_overlay():
    return render_template('markeroverlay.html', branding=False)

@app.route("/manualmission")
def manualmission():
    return render_template('Layout.html', branding=False)


listeners_location = []
# listeners_location

from threading import Thread
import time
def tcount():
    while True:
        time.sleep(0.25)
        try:
            for id in vehicles:
                msg = state_msg(id)
                for x in listeners_location:
                    x.put(msg)
        except Exception as e:
            pass
t = Thread(target=tcount)
t.daemon = True
t.start()

@app.route("/api/sse/state")
def api_sse_location():
    def gen():
        q = Queue()
        listeners_location.append(q)
        try:
            while True:
                result = q.get()
                ev = sse_encode(result)
                yield ev.encode()
        except GeneratorExit: # Or maybe use flask signals
            listeners_location.remove(q)

    return Response(gen(), mimetype="text/event-stream")

# @app.route("/api/location", methods=['GET', 'POST', 'PUT'])
# def api_location():
#     if request.method == 'POST' or request.method == 'PUT':
#         try:
#             data = request.get_json()
#             (lat, lon) = (float(data['lat']), float(data['lon']))
#             goto(lat, lon)
#             return jsonify(ok=True)
#         except Exception as e:
#             print(e)
#             return jsonify(ok=False)
#     else:
#         return jsonify(**location_msg())


@app.route("/api/arm", methods=['POST', 'PUT'])
def api_location():
    if request.method == 'POST' or request.method == 'PUT':
        try:
            id = int(request.json['id'])
            arm_and_takeoff(int(request.json['alt']), id)
            # vehicle.armed = True
            # vehicle.flush()
            return jsonify(ok=True)
        except Exception as e:
            print(e)
            return jsonify(ok=False)

@app.route("/api/mode", methods=['POST', 'PUT'])
def api_mode():
    if request.method == 'POST' or request.method == 'PUT':
        try:
            id = int(request.json['id'])
            vehicles.get(id).mode = VehicleMode(request.json['mode'].upper())
            vehicles.get(id).flush()
            return jsonify(ok=True)
        except Exception as e:
            print(e)
            return jsonify(ok=False)

@app.route("/api/goto", methods=['POST', 'PUT'])
def api_goto():
    if request.method == 'POST' or request.method == 'PUT':
        try:
            id = int(request.json['id'])
            waypoints=request.json['waypoints']
            print("Set default/target airspeed to 3")
            vehicles.get(id).airspeed = 3
            for xy in waypoints:
                print("Going to : lat ", xy[1] , " long : " , xy[0])
                waypoint = LocationGlobalRelative(float(xy[1]), float(xy[0]), 20)
                vehicles.get(id).simple_goto(waypoint)
                time.sleep(30)

            # vehicle.mode = VehicleMode(request.json['mode'].upper())
            vehicle.flush()
            return "ok"
        except Exception as e:
            print(e)
            return "failed"

@app.route("/api/connect", methods=['POST','PUT'])
def api_connect():
    if request.method =='POST' or request.method == 'PUT':
        try:
            addr = request.json['addr']
            baudrate = request.json['baudrate']
            id = int(request.json['id'])
            print('connecting to drone...')
            nvehicle = None
            # connection_string = str(addr) + ":" + str(baud) 
            c=0
            while not nvehicle and c<2:
                try:
                    nvehicle = connect(str(addr), wait_ready=True, baud=int(baudrate))
                    nvehicle.id = id
                    vehicles[id] = nvehicle
                    # vehicles.append(nvehicle)
                    print(vehicles.get(id).airspeed)
                    vehicles.get(id).parameters['ARMING_CHECK'] = 0
                    vehicles.get(id).flush()
                    print("Vehicle Connected")
                except Exception as e:
                    print('waiting for connection... (%s)' % str(e))
                    c+=1
                    time.sleep(2)
#             return "oks"
            if not nvehicle:
                return jsonify(error=1,msg="Failed to Connect to Vehicle")
            else:
                nlon = vehicles.get(id).location.global_relative_frame.lon
                nlat = vehicles.get(id).location.global_relative_frame.lat
                return jsonify(error=0,msg="Connection success",lon=nlon,lat=nlat)
        except Exception as e:
            print(e)
            return jsonify(error=1,msg="Failed to Connect to Vehicle")

@app.route("/api/disconnect", methods=['POST','PUT'])
def api_disconnect():
    if request.method =='POST' or request.method == 'PUT':
            try:
                id = int(request.json['id'])
                if id in vehicles:
                    vehicles.get(id).close()
                    vehicles.pop(id)
                return "success"
            except Exception as e:
                print(e)
                return "failed"

def connect_to_drone():
    global vehicles#
    nvehicle = None#
    print('connecting to drone...')
    while not nvehicle:
        try:
            nvehicle = connect(connection_string, wait_ready=True, rate=10)
            nvehicle.id = 1 #
            vehicles.append(nvehicle)#
        except Exception as e:
            print('waiting for connection... (%s)' % str(e))
            time.sleep(2)
    # if --sim is enabled...
    # vehicle.mode = VehicleMode("GUIDED")
    vehicles[0].parameters['ARMING_CHECK'] = 1
    vehicles[0].flush()

    print('connected!')

# api transfer data to engine.py
@app.route("/api/update_data", methods=['POST','PUT'])
def update_data():
    global vehicle_dataList
    if request.method =='POST' or request.method == 'PUT':
            try:
                data = request.json['data']
                vehicle_dataList = []
                for value in data:
                    vehicle_dataList.append(value)
                print(vehicle_dataList)
                return "success"
            except Exception as e:
                print(e)
                return "failed"

# api transfer data from engine.py
@app.route("/api/get_data", methods=['POST','PUT'])
def get_data():
    global vehicle_dataList
    if request.method =='POST' or request.method == 'PUT':
            try:
                datasend = ""
                print("vehicle_dataList:")
                print(vehicle_dataList)
                return jsonify(error=0, data=vehicle_dataList)
            except Exception as e:
                print(e)
                return "failed"


# Never cache
@app.after_request
def never_cache(response):
    response.headers['Last-Modified'] = datetime.now()
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# t2 = Thread(target=connect_to_drone)
# t2.daemon = True
# t2.start()

def main():
    app.run(threaded=True, host='127.0.0.1', port=5000)

if __name__ == "__main__":
    main()
