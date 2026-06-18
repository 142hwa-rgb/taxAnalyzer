$irmaaSchedule = @(
    @{ cap = 218000; fee = 0 },
    @{ cap = 274000; fee = 191.40 },
    @{ cap = 342000; fee = 481.00 },
    @{ cap = 410000; fee = 770.00 },
    @{ cap = 750000; fee = 1059.00 },
    @{ cap = [double]::PositiveInfinity; fee = 1155.40 }
)

function Get-Irmaa($agi) {
    for ($i = 0; $i -lt $irmaaSchedule.Count; $i++) {
        $tier = $irmaaSchedule[$i]
        if ($agi -le $tier.cap) {
            return [PSCustomObject]@{
                Tier = $i + 1
                Monthly = $tier.fee
                Annual = [math]::Round($tier.fee * 12, 2)
            }
        }
    }
    return $null
}

$points = @(200000, 250000, 300000, 340000, 360000, 410000, 500000, 750000, 800000)
Write-Output "MAGI,IRMAA Monthly,IRMAA Annual,Tier"
foreach ($agi in $points) {
    $result = Get-Irmaa $agi
    Write-Output "{0},{1},{2},{3}" -f $agi, $result.Monthly, $result.Annual, $result.Tier
}
