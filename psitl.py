import dronekit_sitl as sim
sitl                = sim.start_default()
connection_string   = sitl.connection_string()

nvehicle = connect(connection_string, wait_ready=True, rate=10)