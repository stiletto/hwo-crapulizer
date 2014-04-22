var data = {};
var sel_car = 0;
var sel_step = 0;

document.addEventListener( "DOMContentLoaded", function () {


var cv = document.getElementById('cv');
var status = document.getElementById('status');
var step_slider = document.getElementById('step');
var pl_speed, pl_angle;

function drawTrack() {
    cv.height = cv.offsetHeight;//1000;
    cv.width = cv.offsetWidth;//1000;
    var ctx = cv.getContext('2d');
    var bbox = data.track.bbox;
    var xscale = cv.width/(bbox.max[0]-bbox.min[0]);//0.5;
    var yscale = cv.height/(bbox.max[1]-bbox.min[1]);//0.5;
    if (xscale<yscale) yscale=xscale;
    else xscale=yscale;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.scale(xscale,yscale);
    ctx.translate(-bbox.min[0],-bbox.min[1]);
    var cur_pos = data.steps[sel_step].positions[sel_car].piecePosition;
    var cur_piece_id = cur_pos.pieceIndex;
    data.track.pieces.forEach(function (piece, num) {
        ctx.save();
        ctx.fillStyle = '#' + (num*4).toString(16) + '0000';
        if (num==0) ctx.fillStyle='#00FF00';
        ctx.translate(piece.startX, piece.startY);
        ctx.beginPath();
        ctx.arc(0,0,1,0,2*Math.PI);
        ctx.fill();
        ctx.fillText(num+(piece.radius ? 'a' : ''), 5,-5);
        ctx.rotate(piece.startAngle/180*Math.PI);
        if (piece.radius) {
            ctx.strokeStyle = (num==cur_piece_id) ? "#00BB00" : "#BB0000";
            data.track.lanes.forEach(function (lane) {
                ctx.save();
                ctx.beginPath();
                if (piece.angle<0) {
                    ctx.arc(0,-piece.radius,piece.radius+lane.distanceFromCenter,0.5*Math.PI,(0.5+piece.angle/180)*Math.PI,true);
                } else {
                    ctx.arc(0,piece.radius,piece.radius-lane.distanceFromCenter,1.5*Math.PI,(piece.angle/180+1.5)*Math.PI);
                }
                ctx.lineTo(piece.length,0);
                ctx.stroke();
                ctx.restore();
            });
        } else {
            ctx.strokeStyle = (num==cur_piece_id) ? "#00BB00" : "#000000";
            data.track.lanes.forEach(function (lane) {
                ctx.save();
                ctx.translate(0,lane.distanceFromCenter);
                ctx.beginPath();
                ctx.moveTo(0,0);
                ctx.lineTo(piece.length,0);
                ctx.stroke();
                ctx.restore();
            });
            //ctx.
        }
        //ctx.translate(10,-10);
        ctx.restore();
    });
    var cur_piece = data.track.pieces[cur_piece_id];
    var cur_lane = data.track.lanes[cur_pos.lane.startLaneIndex];
    ctx.save();
    ctx.translate(cur_piece.startX,cur_piece.startY);
    ctx.rotate(cur_piece.startAngle/180*Math.PI);
    ctx.fillStyle = '#FF00FF';
    if (cur_piece.radius) {
        var piece_length = 2*Math.PI*(cur_piece.radius+cur_lane.distanceFromCenter*((cur_piece.angle < 0)?1:-1));
        piece_length *= Math.abs(cur_piece.angle)/360;
        var cur_pos_angle = cur_pos.inPieceDistance/piece_length * cur_piece.angle;
        if (cur_piece.angle<0) {
            ctx.translate(0,-cur_piece.radius);
            ctx.rotate(cur_pos_angle/180*Math.PI);
            ctx.beginPath();
            ctx.arc(0,cur_piece.radius+cur_lane.distanceFromCenter,3,0,2*Math.PI);
        } else {
            ctx.translate(0,cur_piece.radius);
            ctx.rotate(cur_pos_angle/180*Math.PI);
            ctx.beginPath();
            ctx.arc(0,-cur_piece.radius-cur_lane.distanceFromCenter,3,0,2*Math.PI);
        }
        ctx.fill();
        //ctx.beginPath();
    } else {
        ctx.beginPath();
        //alert(JSON.stringify(cur_pos));
        ctx.arc(cur_pos.inPieceDistance,cur_lane.distanceFromCenter,3,0,2*Math.PI);
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    var bbox = data.track.bbox;
    ctx.moveTo(bbox.min[0],bbox.max[1]);
    ctx.lineTo(bbox.min[0],bbox.min[1]);
    ctx.lineTo(bbox.max[0],bbox.min[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.lineTo(bbox.max[0],bbox.max[1]);
    ctx.lineTo(bbox.min[0],bbox.max[1]);
    ctx.stroke();
    /*piece.bbox.forEach(function (bbp) {
            ctx.beginPath();
            ctx.arc(bbp[0],bbp[1],3,0,Math.PI*2);
            ctx.stroke();
        });*/

}

function generatePlots() {
    var speed_plot = [];
    var angle_plot = [];
    data.steps.forEach(function (step, step_no) {
        var speed = Math.sqrt(Math.pow(step.velocities[sel_car].x,2) + Math.pow(step.velocities[sel_car].y,2));
        speed_plot.push([step_no, speed]);
        if ('angleOffset' in step.positions[sel_car])
            angle_plot.push([step_no, step.positions[sel_car].angleOffset]);
        else
            angle_plot.push([step_no, step.positions[sel_car].angle]);
    });
    //console.log(speed_plot);
    pl_speed = $.plot($("#pl_speed"), [speed_plot], {});// yaxis: { max: 1 } });
    pl_angle = $.plot($("#pl_angle"), [angle_plot], {});// yaxis: { max: 1 } });
}

function calculatePositions(track) {
    var x = 0;
    var y = 0;
    var angle = 0;

    function minmax(points) {
        var r = { min: [1E100, 1E100],
                  max: [-1E100, -1E100] };
        points.forEach(function (point) {
            if (point[0]<r.min[0]) r.min[0]=point[0];
            if (point[0]>r.max[0]) r.max[0]=point[0];
            if (point[1]<r.min[1]) r.min[1]=point[1];
            if (point[1]>r.max[1]) r.max[1]=point[1];
        });
        return r;
    }
    function rotate(point,a) {
        var x = point[0]; var y = point[1];
        var sn = Math.sin(a/180*Math.PI);
        var cs = Math.cos(a/180*Math.PI);
        return [x*cs-y*sn,x*sn+y*cs];
    }

    var globb = [];
    track.pieces.forEach(function (piece,id) {
        bbox = [];
        anglemod = 0;
        xmod = 0;
        ymod = 0;
        piece.startX = x;
        piece.startY = y;
        piece.startAngle = angle;
        if (piece.radius) {
            var rot = rotate([0,-piece.radius], Math.abs(piece.angle));
            xmod = rot[0];
            ymod = rot[1]+piece.radius;
            if (piece.angle<0) ymod=-ymod;
            anglemod = piece.angle;
            track.lanes.forEach(function (lane) {
                bbox.push([0,lane.distanceFromCenter]);
                if (piece.angle<0) {
                    rot = rotate([0,-piece.radius-lane.distanceFromCenter], Math.abs(piece.angle));
                    bbox.push([rot[0],-rot[1]-piece.radius]);
                } else {
                    rot = rotate([0,-piece.radius+lane.distanceFromCenter], Math.abs(piece.angle));
                    bbox.push([rot[0],rot[1]+piece.radius]);
                }
            });
        } else {
            track.lanes.forEach(function (lane) {
                bbox.push([0,lane.distanceFromCenter]);
                bbox.push([piece.length,lane.distanceFromCenter]);
            });
            xmod = piece.length;
        }
        var end = rotate([xmod,ymod],angle);
        var mm = minmax(bbox);
        var mmbb = [[mm.min[0],mm.min[1]],[mm.min[0],mm.max[1]],
                    [mm.max[0],mm.min[1]],[mm.max[0],mm.max[1]]];
        mmbb.forEach(function (bbp) {
            var ebp = rotate(bbp,angle);
            globb.push([ebp[0]+x,ebp[1]+y]);
        });
        x += end[0];
        y += end[1];
        angle += anglemod;
        if (angle>=360) angle=angle-360;
        piece.endX = x;
        piece.endY = y;
        piece.endAngle = angle;
    });
    track.bbox = minmax(globb);
}

function loadJSON(evt) {
    var fileString = evt.target.result;
    var nd = {};
    //try {
        var packets = JSON.parse(fileString);
        packets.forEach(function(packet) {
            switch (packet.msgType) {
                case "gameInit":
                    nd.track = packet.data.race.track;
                    nd.cars = packet.data.race.cars;
                    nd.raceSession = packet.data.race.raceSession;
                    nd.gameId = packet.gameId;
                    nd.steps = [];
                    calculatePositions(nd.track);
                    //console.log(JSON.stringify(nd));
                    break;
                case "fullCarPositions":
                    nd.steps.push({positions:packet.data});
                    break;
                case "carVelocities":
                    nd.steps[nd.steps.length-1].velocities = packet.data;
                    break;
            }
        });
        data = nd;
        step_slider.min = 0;
        step_slider.max = nd.steps.length-1;
        drawTrack();
        generatePlots();
    /*} catch(e) {
        alert(e.name);
        return false;
    }*/
}

function loadFile(file) {
    var reader = new FileReader();
    //if file.
    reader.onload = loadJSON;
    reader.onerror = function () { alert("Couldn't read the file"); }
    reader.readAsText(file, "UTF-8");
}

function handleFileSelect(evt) {
    var file = evt.target.files[0];
    if (file) {
        loadFile(file);
    }
}

document.getElementById('file').addEventListener('change', handleFileSelect, false);
function handleStep(evt) {
    var val = evt.target.value;
    if (val==sel_step) return;
    sel_step = val;
    document.getElementById('step_display').textContent = evt.target.value;
    drawTrack();
}
document.getElementById('step').addEventListener('change', handleStep, false);
document.getElementById('step').addEventListener('keydown', handleStep, false);
});
