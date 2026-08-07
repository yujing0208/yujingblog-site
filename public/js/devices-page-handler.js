document.addEventListener('DOMContentLoaded', function () {
	var container = document.getElementById('devices-container');
	var dataEl = document.getElementById('devices-data');
	var buttons = document.querySelectorAll('.filter-tag');
	if (!container || !dataEl || !buttons.length) return;

	var devices = JSON.parse(dataEl.textContent || '{}');

	function renderDevices(brand) {
		var items = devices[brand] || [];
		container.innerHTML = items.map(function(device, index) {
			return [
				'<a href="' + device.link + '" target="_blank" rel="noopener noreferrer"',
				' class="device-card group relative overflow-hidden rounded-xl border border-(--line-divider) bg-(--card-bg) transition-all duration-300 hover:border-(--primary)/50 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-white/5 hover:scale-[1.02] hover:-translate-y-0.5 block cursor-pointer"',
				' style="animation-delay: ' + (index * 100) + 'ms">',
				'<div class="relative p-6 pb-0">',
				'<div class="flex justify-center items-center h-48 bg-linear-to-br from-(--card-bg) to-(--btn-regular-bg) rounded-lg overflow-hidden relative">',
				'<img src="' + device.image + '" alt="' + device.name + '" class="w-auto h-full max-h-full object-contain group-hover:scale-110 transition-all duration-500 drop-shadow-md relative z-10" loading="lazy"/>',
				'</div></div>',
				'<div class="p-6 pt-4 relative z-10">',
				'<h3 class="text-lg font-bold text-black/90 dark:text-white/90 group-hover:text-(--primary) transition-colors duration-300">' + device.name + '</h3>',
				'<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--btn-regular-bg) text-black/70 dark:text-white/70 text-sm my-3">',
				'<span class="font-medium">' + device.specs + '</span></div>',
				'<p class="text-sm text-black/60 dark:text-white/60 line-clamp-2">' + device.description + '</p>',
				'</div></a>'
			].join('');
		});
	}

	buttons.forEach(function(btn) {
		btn.addEventListener('click', function() {
			buttons.forEach(function(b) { b.classList.remove('active'); });
			btn.classList.add('active');
			renderDevices(btn.getAttribute('data-brand'));
		});
	});
});
