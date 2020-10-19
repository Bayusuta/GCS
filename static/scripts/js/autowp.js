var graph = new Map();

function setGraph(source, destination, distance){
    if(!graph.get(source)){
        graph.set(source, []);
    }
    graph.get(source).push({dst:destination, weight:distance});

    if(!graph.get(destination)){
        graph.set(destination, []);
    }
    graph.get(destination).push({dst:source, weight:distance});
}

function findPath(source){
    var picked = new Map();
    picked.set(source, true);

    var first = graph.get(source);
    console.log("Source : "+ source);

    var jarak_terdekat = [];
    first.forEach(function(item){
        console.log(item);
        var inserted = false;
        for(var i=0; i<jarak_terdekat.length; i++){
            if(jarak_terdekat[i].weight > item.weight ){
                jarak_terdekat.splice(i, 0, item);
                inserted = true;
                break;
            }
        }
        if(!inserted){
            jarak_terdekat.push(item);
        }
    });

    console.log("Sudah diurutkan: ");
    jarak_terdekat.forEach(function(item){
        console.log(item);
    });

    var start = [jarak_terdekat[0].dst];
    var end = [jarak_terdekat[1].dst];

    picked.set(start[0], true);
    picked.set(end[0], true);

    var queue = [];
    queue.unshift(start[0]);
    queue.unshift(end[0]);

    console.log("\n==== Caclulating ====");
    while(queue.length > 0){
        var queue_top = queue.pop();
        console.log("\nEdge sekarang = " + queue_top);
        var edge_now = graph.get(queue_top);

        var jarak_terdekat_ = [];
        for(var i=0; i<edge_now.length; i++){
            var item = edge_now[i];
            if(picked.get(item.dst)) continue;
            console.log(item);

            var inserted = false;
            for(var j=0; j<jarak_terdekat_.length; j++){
                if(jarak_terdekat_[j].weight > item.weight ){
                    jarak_terdekat_.splice(j, 0, item);
                    inserted = true;
                    break;
                }
            }

            if(!inserted) jarak_terdekat_.push(item);
        }

        console.log("Sudah diurutkan dari edge : " + queue_top);
        jarak_terdekat_.forEach(function(item){
            console.log(item);
        });

        if(jarak_terdekat_.length > 0){
            if(queue_top == start[start.length-1]){
                start.push(jarak_terdekat_[0].dst);
                console.log("push [" + jarak_terdekat_[0].dst + "] ke start");
            }else if(queue_top == end[end.length-1]){
                end.push(jarak_terdekat_[0].dst);
                console.log("push [" + jarak_terdekat_[0].dst + "] ke end");
            }
            picked.set(jarak_terdekat_[0].dst, true);
            queue.unshift(jarak_terdekat_[0].dst);
        }
    }

    console.log("done~");
    console.log("Start path : ");
    start.forEach(function(item){
        console.log(item);
    });
    console.log("End path : ");
    end.forEach(function(item){
        console.log(item);
    });

    console.log("\n\n=================");
    console.log("Maka urutan perjalanan adalah :");

    process.stdout.write(source + " -> ");
    start.forEach(function(item){
        process.stdout.write(item + " -> ");
    });

    while(end.length > 0){
        process.stdout.write(end.pop() + " -> ");
    }
    
    console.log(source);
}


// setGraph(5,6,4);

/*
Graph Visualitation : https://jamboard.google.com/d/1pyqZULYsrWX4cmByj1fG9jktdDnnNkGbQP2TOyQ4qz4/edit?usp=sharing
*/

// Graph problem A
// setGraph(0,2,2);
// setGraph(0,1,1);
// setGraph(0,3,5);

// setGraph(1,2,3);
// setGraph(1,3,2);

// setGraph(2,3,3);


// Graph problem B
setGraph(0,1,1);
setGraph(0,2,2);
setGraph(0,3,9);
setGraph(0,4,9);

setGraph(1,2,9);
setGraph(1,3,9);
setGraph(1,4,4);

setGraph(2,3,3);
setGraph(2,4,9);

setGraph(3,4,10);

findPath(0);

// console.log(graph);