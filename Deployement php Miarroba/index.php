<html>
    <?php
        function webLoad($requestURL, $scriptName){
            $url = $requestURL;
            $ch = curl_init();  
            curl_setopt($ch,CURLOPT_URL,$url);
            curl_setopt($ch,CURLOPT_RETURNTRANSFER,1);
            $page = curl_exec($ch);
            curl_close($ch);
            echo "<script>var $scriptName = $page;</script>";
        }
    ?>
    <head><link rel="stylesheet" href="style.css" /></head>
    <body><center>
        <table width="950" height="65"><tr>
            <td width="180"></td>
            <td width="400"><input id="search"/></td>
            <td width="80"><button id="submit">Search</button></td>
            <td>&nbsp;</td>
			<td width="90"><button>Log in</button></td>
        </tr></table>
        <img width="950" src="https://uploads-ssl.webflow.com/6123b7f3a062a25a8b4d4119/6287bdb869b482145f371e15_access.png">
        <table width="950" id="VisualTable"></table>
		<?php
			webLoad("https://webcloud.sl.se/api/v2/departures?mode=departures&origPlaceId=QT0xQE89QnJvbW1hcGxhbiAoU3RvY2tob2xtKUBYPTE3OTM3ODY3QFk9NTkzMzgyOThAVT03NEBMPTMwMDEwOTEwOUBCPTFAcD0xNjU0NTYzNjE1QA%3D%3D&origSiteId=9109&desiredResults=3&origName=Brommaplan+%28Stockholm%29", "trafficBromma");
			webLoad("https://webcloud.sl.se/api/v2/departures?mode=departures&origPlaceId=QT0xQE89T2RlbnBsYW4gKFN0b2NraG9sbSlAWD0xODA0OTA5OUBZPTU5MzQyOTAxQFU9NzRATD0zMDAxMDkxMTdAQj0xQHA9MTY1NTI1NDgxNEA%3D&origSiteId=9117&desiredResults=3&origName=Odenplan+%28Stockholm%29", "trafficOdenplan");
			webLoad("https://webcloud.sl.se/api/v2/departures?mode=departures&origPlaceId=QT0xQE89VG9yc3BsYW4gKFN0b2NraG9sbSlAWD0xODAzMjkzNkBZPTU5MzQ1NDE3QFU9NzRATD0zMDAxMDEwNjVAQj0xQHA9MTY1NTI1NDgxNEA%3D&origSiteId=1065&desiredResults=3&origName=Torsplan+%28Stockholm%29", "trafficTorsplan");
			webLoad("https://www.yr.no/api/v0/locations/2-2673730/forecast", "weather");
		?>
		<?php
			function databaseLoad(){
			    $servername = "mysql.webcindario.com";
			    $username = "mosverkstad";
			    $password = "Winnie1234";
			    $dbname = "mosverkstad";
				$conn = mysqli_connect($servername, $username, $password, $dbname);
				if (!$conn) {
					die("Connection failed: " . mysqli_connect_error());
				}
				
				$resultItems = mysqli_query($conn, "SELECT id, item FROM mosverkstad.nameTable;");
				if (mysqli_num_rows($resultItems) <= 0){
					echo "<script>var dbItems = []</script>";
					echo "<script>var dbRelationship = []</script>";
					return;
				}
				echo "<script>var dbItems = [";
				while($row = mysqli_fetch_assoc($resultItems)) {
					echo "{id: " . $row["id"] . ", name: '" . $row["item"] . "', nodes: []},";
				}
				echo "]</script>";
				
				$resultRelationship = mysqli_query($conn, "SELECT * FROM mosverkstad.relationship;");
				if (mysqli_num_rows($resultRelationship) <= 0){
					echo "<script>var dbRelationship = []</script>";
					return;
				}
				echo "<script>var dbRelationship = [";
				while($row = mysqli_fetch_assoc($resultRelationship)) {
					echo "{parentId: " . $row["parentId"] . ", childId: " . $row["childId"] . "},";
				}
				echo "]</script>";
				
				mysqli_close($conn);
				return;
			}
			databaseLoad()
		?>
        <script src="main.js"></script>
    </center></body>
</html>