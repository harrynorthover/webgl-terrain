TERRAIN_GEN.Application = new function() {
	debug = false;

	var _CONTAINER, gui, scene, camera, renderer, 
		geometry, mesh, baseMat, cursor, mousePos, 
		cameraTarget, isMouseDown, isShiftDown, 
		projector, mouseMovementEnabled, ambient, light,
		intersects;

	WIDTH = window.innerWidth;
	HEIGHT = window.innerHeight;
	
	raiseBoundaryX = 35;
	raiseBoundaryZ = 35;
	BASE_BOUNDARY = 35;
	
	TERRAIN_WIDTH = 1500;
	TERRAIN_HEIGHT = 1100;
	TERRAIN_DEPTH = 15;
	
	VIEW_ANGLE = 50;
	ASPECT = WIDTH / HEIGHT;
	NEAR = 1;
	FAR = 10000;
	
	prevRotationX = 0;
	prevRotationY = 0;
	prevRotationZ = 0;
	prevOpacity = 1;
	theta = 45;
	
	tool = 'raiseTerrain';
	
	cursor_size = 60;
	cursor_depth = 15;
	cursor_color = 0x2FA1D6;
	
	// COLORS
	GRASS = 0x66CC66;
	SEA = 0x3366CC;
	WHITE = 0xFFFFFF;
	
	dimOnActivity = false;
	
	that = this;

	this.init = function() {
		_CONTAINER = document.getElementById('container');
		_CONTAINER.width = WIDTH;
		_CONTAINER.height = HEIGHT;
		
		document.addEventListener('mousedown', this.onMouseDown);
		document.addEventListener('mouseup', this.onMouseUp);
		document.addEventListener('mousemove', this.onMouseMove);
		document.addEventListener('keydown', this.onKeyDown);
		document.addEventListener('keyup', this.onKeyUp);
		
		mouseMovementEnabled = true;
		
		this.init3D();
		this.init2D();
	};
	
	this.init2D = function() {
		gui = new dat.GUI();
		
		gui.add(window, 'debug').onChange(function(nv) {
			light.shadowCameraVisible = debug;
			baseMat.wireframe = debug;
		});
		//gui.add(window, 'dimOnActivity');
		
		var cursorControls = gui.addFolder('Cursor');
		cursorControls.add(cursor.scale, 'x').min(0.1).max(15).step(.1).onChange(function(nv) {
			raiseBoundaryX = BASE_BOUNDARY * nv;
		});
		cursorControls.add(cursor.scale, 'z').min(0.1).max(15).step(.1).onChange(function(nv) {
			raiseBoundaryZ = BASE_BOUNDARY * nv;
		});
		
		// Terrain rotation.
		var terrainControls = gui.addFolder('Terrain');
		terrainControls.add(mesh.rotation, 'x').min(0).max(6).step(.01).onChange(function(nv) {
			mesh.rotation.x = nv;
			cursor.rotation.x = nv;
			prevRotationX = nv;
		});
		terrainControls.add(mesh.rotation, 'y').min(0).max(6).step(.01).onChange(function(nv) {
			mesh.rotation.y = nv;
			cursor.rotation.y = nv;
			prevRotationY = nv;
		});
		terrainControls.add(mesh.rotation, 'z').min(0).max(6).step(.01).onChange(function(nv) {
			mesh.rotation.z = nv;
			cursor.rotation.z = nv;
			prevRotationZ = nv;
		});
		terrainControls.add(baseMat, 'wireframe');
		terrainControls.add(baseMat, 'opacity').min(0).max(1).step(0.05).onChange(function(nv) { prevOpacity = nv; });
		terrainControls.add(that, 'resetTerrain');
	};
	
	this.init3D = function() {
		renderer = new THREE.WebGLRenderer({ antialias:true });
		renderer.shadowMapEnabled = true;
		renderer.setSize(WIDTH, HEIGHT);
		
		_CONTAINER.appendChild(renderer.domElement);
		
		scene = new THREE.Scene();
		projector = new THREE.Projector();
		ambient	= new THREE.AmbientLight( 0x444444 );
		light = new THREE.SpotLight( 0xFFAA88, 7 );
		
		camera = new THREE.CombinedCamera( window.innerWidth, window.innerHeight, VIEW_ANGLE, NEAR, FAR );
		camera.position.y = 800;

		light.target.position.set( 0, 0, 0 );
		light.shadowCameraNear = 0.1;
		light.shadowCameraFov = 70;		
		light.castShadow = true;
		light.shadowDarkness = 10;
		light.shadowCameraVisible = debug;
		light.position.x = -800;
		light.position.y = 400;
		
		scene.add(camera);
		scene.add(ambient);
		scene.add(light);
						
		this.createScene();
	};
	
	/**
	 * This generates the initial plain terrain. 
	 */
	this.createScene = function() {		
		// create the geometry for the plane.
		geometry = new THREE.CubeGeometry( TERRAIN_WIDTH, TERRAIN_DEPTH, TERRAIN_HEIGHT, 100, 1, 100 );
		// create base material.
		baseMat = new THREE.MeshLambertMaterial({ color:0x333333, wireframe:debug, opacity:1 });
		// init vector to keep track of mouse position.
		mousePos = new THREE.Vector3( 0, 0, 0.5 );
		// create center target for camera to look at.
		cameraTarget = new THREE.Vector3( 0, 0, 0 );
		
		//create & add the cursor
		cursor = new THREE.Mesh( new THREE.CubeGeometry(cursor_size, cursor_depth, cursor_size), new THREE.MeshBasicMaterial({ color:cursor_color, wireframe:false, opacity:0.5 }) );
		scene.add(cursor);
		
		this.generateTerrain(geometry);

		setInterval(this.animate, 1000 / 60, renderer, scene, camera);
	};
	
	/**
	 * Generate a new terrain by taking a geometry, applying it to 
	 * a mesh and rendering it. 
	 */
	this.generateTerrain = function(g) {
		geometry.verticesNeedUpdate = true;
		geometry.normalsNeedUpdate = true;
		geometry.dynamic = true;
		
		mesh = new THREE.Mesh(g, baseMat);
		mesh.geometry = g;
		mesh.castShadow = true;
		mesh.recieveShadow = true;
		mesh.rotation.y = prevRotationY;
		mesh.rotation.x = prevRotationX;
		mesh.rotation.z = prevRotationZ;

		// remove existing terrain.
		scene.remove(scene.getChildByName('terrain'));
		scene.add(mesh);
		
		mesh.name = 'terrain';
	};
	
	this.updateTerrain = function() {
		if(isMouseDown && !isShiftDown) {
			if(tool == 'raiseTerrain')
				this.raiseTerrain();
			else if(tool == 'lowerTerrain')
				this.lowerTerrain();
		}
	};
	
	this.resetTerrain = function() {
		// create a new terrain geometry. 
		geometry = new THREE.CubeGeometry( TERRAIN_WIDTH, TERRAIN_DEPTH, TERRAIN_HEIGHT, 80, 1, 80 );
		
		// reset all the rotation for cursor and terrain. 	
		prevRotationX = prevRotationY = prevRotationZ = 0;
		cursor.rotation.x = cursor.rotation.y = cursor.rotation.z = 0;
		
		// generate a new terrain.
		this.generateTerrain(geometry);
	};
	
	this.raiseTerrain = function() {
		for( var i = 0; i < geometry.vertices.length; ++i ) {
			var v = geometry.vertices[i];
			
			// check to see if the vertex is underneath the cursor.
			if(this.checkVertexPosition(v))
				v.y += Math.random() * 15;
		}
		
		this.generateTerrain(geometry);
	};
	
	this.lowerTerrain = function() {
		for( var i = 0; i < geometry.vertices.length; ++i ) {
			var v = geometry.vertices[i];
			
			// check to see if the vertex is underneath the cursor.
			if(this.checkVertexPosition(v))
				v.y -= Math.random() * 15;
		}
		
		this.generateTerrain(geometry);
	};
	
	this.checkVertexPosition = function(vertex) {
		if(vertex.x >= cursor.position.x - raiseBoundaryX && vertex.x <= cursor.position.x + raiseBoundaryX && vertex.z >= cursor.position.z - raiseBoundaryZ && vertex.z <= cursor.position.z + raiseBoundaryZ)
			return true;
		else
			return false;
	};
	
	this.checkIntersects = function() {
		projector.unprojectVector(mousePos, camera);
		
		var ray = new THREE.Ray(camera.position, mousePos.subSelf(camera.position).normalize());
		var intersects = ray.intersectObject(mesh);
		
		if(intersects.length > 0)
			return intersects;
		else 
			return null;
	};
	
	this.toggleWireframe = function() {
		baseMat.wireframe = (baseMat.wireframe == true) ? false : true;
	};
	
	/* 
	 * Render loop
	 */
	
	this.animate = function(r,s,c) {
		that.updateTerrain();
	
		camera.position.x = 1400 * Math.sin( theta * Math.PI / 360 );
		camera.position.z = 1400 * Math.cos( theta * Math.PI / 360 );
		camera.lookAt( cameraTarget );
				
		if(isMouseDown && mouseMovementEnabled && isShiftDown) {
			mesh.rotation.y -= (mousePos.x / 10) + 0.035;			
			cursor.rotation.y -= (mousePos.x / 10)  + 0.035;
			
			prevRotationY = mesh.rotation.y;
		}
		
		r.render(s, c);
	};
	
	/*
	 * Event listeners
	 */
	
	this.onMouseDown = function(e) {
		// check to see if mouse is over terrain
		if(intersects!=null) {
			isMouseDown = true;
			
			if(dimOnActivity)
				mesh.material.opacity = 0.5;
		}
	};
	
	this.onMouseUp = function(e) {
		isMouseDown = false;
		mesh.material.opacity = prevOpacity;
	};
	
	this.onMouseMove = function(e) {
		mousePos.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		mousePos.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
		mousePos.z = 0.5;
		
		intersects = that.checkIntersects();
		
		if(intersects != null) 
			cursor.position = intersects[0].point;
	};
	
	this.onKeyDown = function(e) {
		e.preventDefault();
	
		if(debug)
			console.log('KEY PRESSED: ' + e.keyCode);
	
		switch(e.keyCode) {
			// shift
			case 16:
				isShiftDown = true;
				break;
			// spacebar
			case 32:
				tool = ( tool == 'raiseTerrain' ) ? 'lowerTerrain' : 'raiseTerrain';
				break;
			// c
			case 67:
				that.resetTerrain();
				break;
			// w
			case 87:
				that.toggleWireframe();
				break;
			// d
			case 68:
				debug = (debug) ? false : true;
				light.shadowCameraVisible = debug;
				baseMat.wireframe = debug;
				break;
		}
	};
	
	this.onKeyUp = function(e) {
		switch(e.keyCode) {
			case 16:
				isShiftDown = false;
				break;
		}
	};
};