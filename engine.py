#!/usr/bin/env python
#HAI
from dronekit import connect, VehicleMode, LocationGlobalRelative, Command
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

'''
dronekit_sitl adalah library yang akan kita gunakan untuk melakukan simulasi tanpa memerlukan wahana
di bawah ini sudah kami siapkan dua simulasi (sitl, sitl2)
'''
sitl                = sim.start_default()
connection_string   = sitl.connection_string()
sitl_args = ['-I0', '--model', 'quad', '--home=-7.27762833375229,112.79753757123672,0,180'] #setting koordinat sitl (latitude, longitude)
sitl.launch(sitl_args, await_ready=True, restart=True)

sitl2                = sim.start_default()
connection_string2   = sitl2.connection_string()
sitl_args2 = ['-I1', '--model', 'quad', '--home=-7.277645690419675,112.79749693820645,0,180'] #setting koordinat sitl (latitude, longitude)
sitl2.launch(sitl_args2, await_ready=True, restart=True)

'''
berikut ini merupakan global variabel
'''
vehicles = {} # list vehicles

vehicle_dataList = [] # each item = (id:{key, vehicleColor, address, baudrate, isConnected, home, missionList})
waypoint_list = [] # each item = (id:{lon,lat})
homepoint_list = [] # each item = (id:{lon,lat})
mission_list = [] # each item = (id:{value})

# Allow us to reuse sockets after the are bound.
# http://stackoverflow.com/questions/25535975/release-python-flask-port-when-script-is-terminated
socket.socket._bind = socket.socket.bind
def my_socket_bind(self, *args, **kwargs):
    self.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    return socket.socket._bind(self, *args, **kwargs)
socket.socket.bind = my_socket_bind

'''
berikut ini merupakan block code untuk memberikan informasi terbarukan tentang vehicle yang telah terkoneksi
'''
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


'''
berikut ini merupakan fungsi untuk melakukan arming sekaligus takeoff secara otomatis
'''
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

'''
Konfigurasi Flask
'''
app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
app.config['TEMPLATES_AUTO_RELOAD'] = True

@app.route("/")
def index():
    return redirect(url_for('status'))

@app.route("/status")
def status():
    return render_template('status.html', branding=False)

@app.route("/plan")
def plan():
    return render_template('plan.html', branding=False)

# listeners_location
listeners_location = []

'''
Melakukan threading untuk men-generate informasi terbarukan vehicle
'''
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


'''
API dalam melakukan update informasi terbarukan vehicle
'''

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


'''
API dalam melakukan arming secara otomatis
'''
@app.route("/api/arm", methods=['POST', 'PUT'])
def api_location():
    if request.method == 'POST' or request.method == 'PUT':
        try:
            id = int(request.json['id'])
            arm_and_takeoff(int(request.json['alt']), id)
            vehicles.get(id).armed = True
            vehicles.get(id).flush()
            return jsonify(ok=True)
        except Exception as e:
            print(e)
            return jsonify(ok=False)

'''
API untuk mengubah mode vehicle
'''
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

'''
API untuk menggerakan vehicle ke titik yang diinginkan
'''
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

            vehicle.get(id).mode = VehicleMode(request.json['mode'].upper())
            vehicles.get(id).flush()
            return "ok"
        except Exception as e:
            print(e)
            return "failed"

'''
API dalam melakukan koneksi ke vehicle
'''
@app.route("/api/connect", methods=['POST','PUT'])
def api_connect():
    if request.method =='POST' or request.method == 'PUT':
        try:
            addr = request.json['addr']
            baudrate = request.json['baudrate']
            id = int(request.json['id'])
            print('connecting to drone...')
            nvehicle = None
            try:
                '''
                timeout = lama waktu menunggu vehicle terkoneksi
                heartbeat_timeout = waktu yang dibutuhkan untuk terkoneksi kembali jika lost connection
                '''
                nvehicle = connect(str(addr), wait_ready=True, timeout=120, heartbeat_timeout=90, baud=int(baudrate))
                nvehicle.id = id
                vehicles[id] = nvehicle
                # vehicles.append(nvehicle)
                print(vehicles.get(id).airspeed)
                vehicles.get(id).parameters['ARMING_CHECK'] = 0
                vehicles.get(id).flush()
                print("Vehicle Connected")
            except Exception as e:
                nvehicle.close()
                print('waiting for connection... (%s)' % str(e))
            if not nvehicle:
                return jsonify(error=1,msg="Failed to Connect to Vehicle")
            else:
                nlon = vehicles.get(id).location.global_relative_frame.lon
                nlat = vehicles.get(id).location.global_relative_frame.lat
                return jsonify(error=0,msg="Connection success",lon=nlon,lat=nlat)
        except Exception as e:
            print(e)
            return jsonify(error=1,msg="Failed to Connect to Vehicle")

'''
API dalam memutuskan koneksi vehicle
'''
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


'''
API untuk melakukan transfer data dari front-end ke back-end
'''
# api transfer data to engine.py
@app.route("/api/update_data", methods=['POST','PUT'])
def update_data():
    global vehicle_dataList
    global homepoint_list
    global waypoint_list
    global mission_list
    if request.method =='POST' or request.method == 'PUT':
        try:
            data_type = request.json['type']
            data = request.json['data']
            if data_type == "vehicle_dataList":
                vehicle_dataList = []
                for value in data:
                    vehicle_dataList.append(value)
                print(vehicle_dataList)
            elif data_type == "homepoint_list":
                homepoint_list = []
                for value in data:
                    homepoint_list.append(value)
                print(homepoint_list)
            elif data_type == "waypoint_list":
                waypoint_list = []
                for value in data:
                    waypoint_list.append(value)
                print(waypoint_list)
            elif data_type == "mission_list":
                mission_list = []
                for value in data:
                    mission_list.append(value)
                print(mission_list)
            return "success"
        except Exception as e:
            print(e)
            return "failed"

'''
API untuk melakukan transfer data dari back-end ke front-end
'''
@app.route("/api/get_data", methods=['POST','PUT'])
def get_data():
    global vehicle_dataList
    global homepoint_list
    global waypoint_list
    global mission_list
    if request.method =='POST' or request.method == 'PUT':
        try:
            data_request = request.json['request']
            if data_request == "vehicle_dataList":
                print("vehicle_dataList:")
                print(vehicle_dataList)
                return jsonify(error=0, data=vehicle_dataList)
            elif data_request == "homepoint_list":
                print("homepoint_list:")
                print(homepoint_list)
                return jsonify(error=0, data=homepoint_list)
            elif data_request == "waypoint_list":
                print("waypoint_list:")
                print(waypoint_list)
                return jsonify(error=0, data=waypoint_list)
            elif data_request == "mission_list":
                print("mission_list:")
                print(mission_list)
                return jsonify(error=0, data=mission_list)
        except Exception as e:
            print(e)
            return "failed"

def readmission_file(aFileName, id):
    """
    Load a mission from a file into a list. The mission definition is in the Waypoint file
    format (http://qgroundcontrol.org/mavlink/waypoint_protocol#waypoint_file_format).
    This function is used by upload_mission().
    """
    print("\nReading mission from file: %s" % aFileName)
    global vehicles
    cmds = vehicles.get(id).commands
    missionlist=[]
    with open(aFileName) as f:
        for i, line in enumerate(f):
            if i==0:
                if not line.startswith('QGC WPL 110'):
                    raise Exception('File is not supported WP version')
            else:
                linearray=line.split('\t')
                ln_index=int(linearray[0])
                ln_currentwp=int(linearray[1])
                ln_frame=int(linearray[2])
                ln_command=int(linearray[3])
                ln_param1=float(linearray[4])
                ln_param2=float(linearray[5])
                ln_param3=float(linearray[6])
                ln_param4=float(linearray[7])
                ln_param5=float(linearray[8])
                ln_param6=float(linearray[9])
                ln_param7=float(linearray[10])
                ln_autocontinue=int(linearray[11].strip())
                cmd = Command( 0, 0, 0, ln_frame, ln_command, ln_currentwp, ln_autocontinue, ln_param1, ln_param2, ln_param3, ln_param4, ln_param5, ln_param6, ln_param7)
                missionlist.append(cmd)
    return missionlist

def readmission_text(mission_text, id):
    global vehicles
    cmds = vehicles.get(id).commands
    missionlist=[]
    data = mission_text.split("\n")
    i=0
    for line in data:
        print("line :")
        print(line)
        if i!=0 and len(line)>0:
            linearray=line.split('\t')
            ln_index=int(linearray[0])
            ln_currentwp=int(linearray[1])
            ln_frame=int(linearray[2])
            ln_command=int(linearray[3])
            ln_param1=float(linearray[4])
            ln_param2=float(linearray[5])
            ln_param3=float(linearray[6])
            ln_param4=float(linearray[7])
            ln_param5=float(linearray[8])
            ln_param6=float(linearray[9])
            ln_param7=float(linearray[10])
            ln_autocontinue=int(linearray[11].strip())
            cmd = Command( 0, 0, 0, ln_frame, ln_command, ln_currentwp, ln_autocontinue, ln_param1, ln_param2, ln_param3, ln_param4, ln_param5, ln_param6, ln_param7)
            missionlist.append(cmd)       
        i+=1         
    return missionlist

def upload_mission_file(aFileName, id):
    """
    Upload a mission from a file. 
    """
    global vehicles
    #Read mission from file
    missionlist = readmission_file(aFileName, id)
    
    print("\nUpload mission from a file: %s" % aFileName)
    #Clear existing mission from vehicle
    print(' Clear mission')
    cmds = vehicles.get(id).commands
    cmds.clear()
    #Add new mission to vehicle
    for command in missionlist:
        cmds.add(command)
    print(' Upload mission')
    vehicles.get(id).commands.upload()

def upload_mission_text(mission_text, id):
    """
    Upload a mission from a text mission. 
    """
    global vehicles
    #Read mission from file
    missionlist = readmission_text(mission_text, id)
    
    print("\nUpload mission from a text:\n%s" % mission_text)
    #Clear existing mission from vehicle
    print(' Clear mission')
    cmds = vehicles.get(id).commands
    cmds.clear()
    #Add new mission to vehicle
    for command in missionlist:
        cmds.add(command)
    print(' Upload mission')
    vehicles.get(id).commands.upload()

'''
Upload mission to vehicle
'''
@app.route("/api/upload_mission", methods=['POST','PUT'])
def upload_mission():
    global vehicles
    if request.method =='POST' or request.method == 'PUT':
        try:
            vehicle_id = request.json['id']
            mission_text = request.json['mission_text']
            
            print("mission_text:")
            print(mission_text)
            upload_mission_text(mission_text, vehicle_id)
            return "Upload success"
        except Exception as e:
            print(e)
            return "failed"

'''
Import mission from given file path
'''
@app.route("/api/import_mission", methods=['POST','PUT'])
def import_mission():
    if request.method =='POST' or request.method == 'PUT':
        try:
            file_path = request.json['file_path']
            wp_list = []
            with open(file_path) as f:
                for i, line in enumerate(f):
                    if i>1:
                        linearray=line.split('\t')
                        lat=float(linearray[8])
                        lon=float(linearray[9])
                        wp_list.append([lon,lat])
            wp_list.pop()
            return jsonify(wp=wp_list)
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


def main():
    app.run(threaded=True, host='127.0.0.1', port=5000)

if __name__ == "__main__":
    main()
